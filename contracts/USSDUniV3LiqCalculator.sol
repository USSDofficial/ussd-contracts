// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import '@uniswap/v3-core/contracts/libraries/BitMath.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/libraries/SwapMath.sol';
import '@uniswap/v3-core/contracts/libraries/FixedPoint128.sol';

import "./interfaces/IUniswapLiqCalculator.sol";

contract UniV3LiqCalculator is IUniswapLiqCalculator {
    using SafeCast for uint256;

    // the top level state of the swap, the results of which are recorded in storage at the end
    struct SwapState {
        // the amount remaining to be swapped in/out of the input/output asset
        int256 amountSpecifiedRemaining;
        // the amount already swapped out/in of the output/input asset
        int256 amountCalculated;
        // current sqrt(price)
        uint160 sqrtPriceX96;
        // the tick associated with the current price
        int24 tick;
        // the global fee growth of the input token
        uint256 feeGrowthGlobalX128;
        // amount of input token paid as protocol fee
        uint128 protocolFee;
        // the current liquidity in range
        uint128 liquidity;
    }

    struct StepComputations {
        // the price at the beginning of the step
        uint160 sqrtPriceStartX96;
        // the next tick to swap to from the current tick in the swap direction
        int24 tickNext;
        // whether tickNext is initialized or not
        bool initialized;
        // sqrt(price) for the next tick (1/0)
        uint160 sqrtPriceNextX96;
        // how much is being swapped in in this step
        uint256 amountIn;
        // how much is being swapped out
        uint256 amountOut;
        // how much fee is being paid in
        uint256 feeAmount;
    }

    // this function implementation is heavily based on uniswap v3 swap function
    // that goes tick to tick to execute swap at price/liquidity ranges
    // similar approach is implemented here to calculate amount of token that is required
    // to be sold to get v3 pool to desired target price
    function calculateAmountTillPriceMatch(address pool, uint160 targetPriceX96) public override view returns (int256) {

        IUniswapV3Pool uniPool = IUniswapV3Pool(pool);

        (uint160 s0sqrtPriceX96,
        int24 s0tick,
        /*uint16 s0observationIndex*/,
        /*uint16 s0observationCardinality*/,
        /*uint16 s0observationCardinalityNext*/,
        uint8 s0feeProtocol,
        /*bool s0unlocked*/) = uniPool.slot0();

        // 10000000000000000000000000 is assumed to be large enough amount to perform a rebalance and move the price
        // buy or sell amount of token0
        int256 amountSpecified = 10000000000000000000000000; // limit for the amount
        bool zeroForOne = true;

        if (targetPriceX96 < s0sqrtPriceX96) {
          amountSpecified = -10000000000000000000000000; // if token0 price is lower than desired -- buy it
          zeroForOne = false;
        }

        uint128 SwapCache_liquidityStart = uniPool.liquidity();	// current range liquidity
        uint8 SwapCache_feeProtocol = zeroForOne ? (s0feeProtocol % 16) : (s0feeProtocol >> 4);

        SwapState memory state =
            SwapState({
                amountSpecifiedRemaining: amountSpecified,
                amountCalculated: 0,
                sqrtPriceX96: s0sqrtPriceX96,
                tick: s0tick,
                feeGrowthGlobalX128: zeroForOne ? uniPool.feeGrowthGlobal0X128() : uniPool.feeGrowthGlobal1X128(),
                protocolFee: 0,
                liquidity: SwapCache_liquidityStart
            });

        // continue swapping as long as we haven't used the entire input/output and haven't reached the price limit
        while (state.sqrtPriceX96 != targetPriceX96) {
            StepComputations memory step;

            step.sqrtPriceStartX96 = state.sqrtPriceX96;

            (step.tickNext, step.initialized) = nextInitializedTickWithinOneWord(
                uniPool,
                state.tick,
                uniPool.tickSpacing(),
                zeroForOne
            );

            // ensure that we do not overshoot the min/max tick, as the tick bitmap is not aware of these bounds
            if (step.tickNext < TickMath.MIN_TICK) {
                step.tickNext = TickMath.MIN_TICK;
            } else if (step.tickNext > TickMath.MAX_TICK) {
                step.tickNext = TickMath.MAX_TICK;
            }

            // get the price for the next tick
            step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

            // compute values to swap to the target tick, price limit, or point where input/output amount is exhausted
            (state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount) = SwapMath.computeSwapStep(
                state.sqrtPriceX96,
                (zeroForOne ? step.sqrtPriceNextX96 < targetPriceX96 : step.sqrtPriceNextX96 > targetPriceX96) ? targetPriceX96 : step.sqrtPriceNextX96,
                state.liquidity,
                state.amountSpecifiedRemaining,
                uniPool.fee()
            );

            state.amountSpecifiedRemaining -= (step.amountIn + step.feeAmount).toInt256();  // decrease limited maximum amount (probably we don't care about it)
            state.amountCalculated = state.amountCalculated - step.amountOut.toInt256(); // probably we don't care about amount we receive

            // if the protocol fee is on, calculate how much is owed, decrement feeAmount, and increment protocolFee
            if (SwapCache_feeProtocol > 0) {
                uint256 delta = step.feeAmount / SwapCache_feeProtocol;
                step.feeAmount -= delta;
                state.protocolFee += uint128(delta);
            }

            // update global fee tracker
            if (state.liquidity > 0)
                state.feeGrowthGlobalX128 += FullMath.mulDiv(step.feeAmount, FixedPoint128.Q128, state.liquidity);

            // shift tick if we reached the next price
            if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
                // if the tick is initialized, run the tick transition
                if (step.initialized) {

                    (,int128 liquidityNet,,,,,,) = uniPool.ticks(step.tickNext); //TickInfo.liquidityNet
                    // if we're moving leftward, we interpret liquidityNet as the opposite sign
                    // safe because liquidityNet cannot be type(int128).min
                    if (zeroForOne) liquidityNet = -liquidityNet;

                    state.liquidity = liquidityNet < 0
                        ? state.liquidity - uint128(-liquidityNet)
                        : state.liquidity + uint128(liquidityNet);
                }

                state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
            } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
                // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
                state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
            }
        }

	    return amountSpecified - state.amountSpecifiedRemaining;
    }

    function position(int24 tick) private pure returns (int16 wordPos, uint8 bitPos) {
        unchecked {
            wordPos = int16(tick >> 8);
            bitPos = uint8(int8(tick % 256));
        }
    }

    // tick mapping is public but a complete map cannot be fetched by obvious reasons,
    // so recreate UniV3 tick map method using v3 pools uniPool.tickBitmap() method
    function nextInitializedTickWithinOneWord(
        IUniswapV3Pool uniPool,
        int24 tick,
        int24 tickSpacing,
        bool lte
    ) internal view returns (int24 next, bool initialized) {
      unchecked {      
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--; // round towards negative infinity

        if (lte) {
            (int16 wordPos, uint8 bitPos) = position(compressed);
            // all the 1s at or to the right of the current bitPos
            uint256 mask = (1 << bitPos) - 1 + (1 << bitPos);
            uint256 masked = uniPool.tickBitmap(wordPos) & mask;

            // if there are no initialized ticks to the right of or at the current tick, return rightmost in the word
            initialized = masked != 0;
            // overflow/underflow is possible, but prevented externally by limiting both tickSpacing and tick
            next = initialized
                    ? (compressed - int24(uint24(bitPos - BitMath.mostSignificantBit(masked)))) * tickSpacing
                    : (compressed - int24(uint24(bitPos))) * tickSpacing;
        } else {
            // start from the word of the next tick, since the current tick state doesn't matter
            (int16 wordPos, uint8 bitPos) = position(compressed + 1);
            // all the 1s at or to the left of the bitPos
            uint256 mask = ~((1 << bitPos) - 1);
            uint256 masked = uniPool.tickBitmap(wordPos) & mask;

            // if there are no initialized ticks to the left of the current tick, return leftmost in the word
            initialized = masked != 0;
            // overflow/underflow is possible, but prevented externally by limiting both tickSpacing and tick
            next = initialized
                    ? (compressed + 1 + int24(uint24(BitMath.leastSignificantBit(masked) - bitPos))) * tickSpacing
                    : (compressed + 1 + int24(uint24(type(uint8).max - bitPos))) * tickSpacing;
        }
      }
    }
}