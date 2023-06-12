// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./interfaces/IUSSDRebalancer.sol";

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import "./interfaces/IUniswapLiqCalculator.sol";

/**
    @dev rebalancer module for USSD ERC20 token. Performs swaps to return USSD/DAI pool balance 1-to-1
         selling USSD for buying collateral or buying and burning USSD for selling collateral
 */
contract USSDRebalancer is AccessControlUpgradeable, IUSSDRebalancer {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // main USSD/DAI pool
    IUniswapV3Pool public uniPool;

    // USSD token
    address public USSD;

    // boundary to make rebalancing
    uint256 private threshold;

    // ratios of collateralization for different collateral accumulating
    uint256[] public flutterRatios;
    
    // base asset for other pool leg (DAI)
    address private baseAsset;

    // role to perform rebalancer management functions
    bytes32 public constant STABLE_CONTROL_ROLE = keccak256("STABLECONTROL");

    // uni v3 liqudity calculator
    // rebalance amount should account for range liquidity
    // target prices are:
    //
    // USSD token0, DAI token1
    // sqrtPriceX96: 79228162514264337593543950336000000
    // tick: 276324
    // target price 1:1, 6 decimals/18 decimals
    //
    // DAI token0, USSD token1
    // sqrtPriceX96: 79228162514264337593543
    // tick: -276325
    // target price 1:1, 18 decimals/6 decimals

    uint160 constant PRICE_USSDFIRST = 79228162514264337593543950336000000;
    uint160 constant PRICE_DAIFIRST = 79228162514264337593543;

    IUniswapLiqCalculator univ3liqcalc;

    function initialize(address _ussd) public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        threshold = 1e4;
        USSD = _ussd;
    }

    modifier onlyControl() {
        require(hasRole(STABLE_CONTROL_ROLE, msg.sender), "control only");
        _;
    }

    function setPoolAddress(address _pool) public onlyControl {
      uniPool = IUniswapV3Pool(_pool);
    }

    function getPool() public view override returns (address) {
        return address(uniPool);
    }

    function setTreshold(uint256 _threshold) public onlyControl {
      threshold = _threshold;
    }

    function setFlutterRatios(uint256[] calldata _flutterRatios) public onlyControl {
      flutterRatios = _flutterRatios;
    }

    function setBaseAsset(address _baseAsset) public onlyControl {
      baseAsset = _baseAsset;
    }

    function setUniswapCalculator(address _calculator) onlyControl public {
      univ3liqcalc = IUniswapLiqCalculator(_calculator);
    }

    /// @dev get price estimation to DAI using pool address and uniswap price
    function getOwnValuation() public view returns (uint256 price) {
      (uint160 sqrtPriceX96,,,,,,) =  uniPool.slot0();
      if(uniPool.token0() == USSD) {
        price = uint(sqrtPriceX96)*(uint(sqrtPriceX96))/(1e6) >> (96 * 2);
      } else {
        price = uint(sqrtPriceX96)*(uint(sqrtPriceX96))*(1e18 /* 1e12 + 1e6 decimal representation */) >> (96 * 2);
        // flip the fraction
        price = (1e24 / price) / 1e12;
      }
    }

    /// @dev return pool balances with USSD first
    // was used in 1st prototype, not used anymore as V3 pools are not just constant product price, but use much
    // more complicated model of ranged/tick liquidity, for that purpsoe a USSDUniV3LiqCalculator module was implemented
    /*function getSupplyProportion() public view returns (uint256, uint256) {
      uint256 vol1 = IERC20Upgradeable(uniPool.token0()).balanceOf(address(uniPool));
      uint256 vol2 = IERC20Upgradeable(uniPool.token1()).balanceOf(address(uniPool));
      if (uniPool.token0() == USSD) {
        return (vol1, vol2);
      }
      return (vol2, vol1);
    }*/

    // calculate swap amount required for reaching target price
    function calculateAmountTillPriceMatch(uint160 targetPriceX96) public view returns (int256 amount0) {
      return univ3liqcalc.calculateAmountTillPriceMatch(address(uniPool), targetPriceX96);
    }

    function rebalance() override public {
      uint256 ownval = getOwnValuation();

      if (ownval < 1e6 - threshold) {
        // peg-down recovery
        uint256 amountToBuy;
        if(uniPool.token0() == USSD) {
          amountToBuy = uint256(calculateAmountTillPriceMatch(PRICE_USSDFIRST));
        } else {
          amountToBuy = uint256(calculateAmountTillPriceMatch(PRICE_DAIFIRST));
        }
        BuyUSSDSellCollateral(amountToBuy / 1e12);

      } else if (ownval > 1e6 + threshold) {
        // mint USSD and buy collateral
        if(uniPool.token0() == USSD) {
          IUSSD(USSD).mintRebalancer(uint256(calculateAmountTillPriceMatch(PRICE_USSDFIRST)));
        } else {
          IUSSD(USSD).mintRebalancer(uint256(calculateAmountTillPriceMatch(PRICE_DAIFIRST)));
        }

        SellUSSDBuyCollateral();
      }
    }

    function BuyUSSDSellCollateral(uint256 amountToBuy) internal {
      CollateralInfo[] memory collateral = IUSSD(USSD).collateralList();
      //uint amountToBuyLeftUSD = amountToBuy * 1e12 * 1e6 / getOwnValuation();
      uint amountToBuyLeftUSD = amountToBuy * 1e12;
      uint DAItosell = 0;
      // Sell collateral in order of collateral array
      for (uint256 i = 0; i < collateral.length; i++) {
        uint256 collateralval = IERC20Upgradeable(collateral[i].token).balanceOf(USSD) * 1e18 / (10**IERC20MetadataUpgradeable(collateral[i].token).decimals()) * collateral[i].oracle.getPriceUSD() / 1e18;
        if (collateralval > amountToBuyLeftUSD) {
          // sell a portion of collateral and exit
          if (collateral[i].pathsell.length > 0) {
            uint256 amountBefore = IERC20Upgradeable(baseAsset).balanceOf(USSD);
            uint256 amountToSellUnits = IERC20Upgradeable(collateral[i].token).balanceOf(USSD) * ((amountToBuyLeftUSD * 1e18 / collateralval) / 1e18) / 1e18;
            IUSSD(USSD).UniV3SwapInput(collateral[i].pathsell, amountToSellUnits);
            DAItosell += (IERC20Upgradeable(baseAsset).balanceOf(USSD) - amountBefore);
          } else {
            // no need to swap DAI
            DAItosell = IERC20Upgradeable(collateral[i].token).balanceOf(USSD) * amountToBuyLeftUSD / collateralval;
          }
          break;
        } else {
          // sell all or skip (if collateral is too little, 5% treshold)
          if (collateralval >= amountToBuyLeftUSD / 20) {
            if (collateral[i].pathsell.length > 0) {
              uint256 amountBefore = IERC20Upgradeable(baseAsset).balanceOf(USSD);
              // sell all collateral and move to next one
              IUSSD(USSD).UniV3SwapInput(collateral[i].pathsell, IERC20Upgradeable(collateral[i].token).balanceOf(USSD));
              amountToBuyLeftUSD -= (IERC20Upgradeable(baseAsset).balanceOf(USSD) - amountBefore);
              DAItosell += (IERC20Upgradeable(baseAsset).balanceOf(USSD) - amountBefore);
            } else {
              // no need to swap DAI
              amountToBuyLeftUSD -= collateralval;
              DAItosell = IERC20Upgradeable(collateral[i].token).balanceOf(USSD) * amountToBuyLeftUSD / collateralval;
            }
          }
        }
      }

      // buy USSD (sell DAI) to burn
      // never sell too much DAI so USSD 'overshoots' (becomes less in quantity than DAI on the pool)
      // otherwise could be arbitraged through mint/redeem
      // the remainder (should be small, due to oracle twap lag) to be left as DAI collateral
      // the execution difference due to fee should be taken into accounting too
      // take 1% safety margin (estimated as 2 x 0.5% fee)
      if (DAItosell > amountToBuy * 1e12 * 99 / 100) {
        DAItosell = amountToBuy * 1e12 * 99 / 100;
      }

      if (DAItosell > 0) {
        if (uniPool.token0() == USSD) {
            IUSSD(USSD).UniV3SwapInput(bytes.concat(abi.encodePacked(uniPool.token1(), hex"0001f4", uniPool.token0())), DAItosell);
        } else {
            IUSSD(USSD).UniV3SwapInput(bytes.concat(abi.encodePacked(uniPool.token0(), hex"0001f4", uniPool.token1())), DAItosell);
        }
      }

      IUSSD(USSD).burnRebalancer(IUSSD(USSD).balanceOf(USSD));
    }

    function SellUSSDBuyCollateral() internal {
      uint256 amount = IUSSD(USSD).balanceOf(USSD);
      // sell for DAI then swap by DAI routes
      uint256 daibought = 0;
      if (uniPool.token0() == USSD) {
        daibought = IERC20Upgradeable(baseAsset).balanceOf(USSD);
        IUSSD(USSD).UniV3SwapInput(bytes.concat(abi.encodePacked(uniPool.token0(), hex"0001f4", uniPool.token1())), amount);
        daibought = IERC20Upgradeable(baseAsset).balanceOf(USSD) - daibought; // would revert if DAI is not bought
      } else {
        daibought = IERC20Upgradeable(baseAsset).balanceOf(USSD);
        IUSSD(USSD).UniV3SwapInput(bytes.concat(abi.encodePacked(uniPool.token1(), hex"0001f4", uniPool.token0())), amount);
        daibought = IERC20Upgradeable(baseAsset).balanceOf(USSD) - daibought; // would revert if DAI is not bought
      }

      if(daibought == 0) {
        return;
      }

      // total collateral portions
      uint256 cf = IUSSD(USSD).collateralFactor();
      uint256 flutter = 0;
      for (flutter = 0; flutter < flutterRatios.length - 1 /* -1 to remain on highest flutter ratio not step over boundary */; flutter++) {
        if (cf < flutterRatios[flutter]) {
          break;
        }
      }

      CollateralInfo[] memory collateral = IUSSD(USSD).collateralList();
      uint portions = 0;
      uint ownval = (getOwnValuation() * 1e18 / 1e6) * IUSSD(USSD).totalSupply() / 1e6; // 1e18 total USSD value
      for (uint256 i = 0; i < collateral.length; i++) {
        uint256 collateralval = IERC20Upgradeable(collateral[i].token).balanceOf(USSD) * 1e18 / (10**IERC20MetadataUpgradeable(collateral[i].token).decimals()) * collateral[i].oracle.getPriceUSD() / 1e18;
        if (collateralval * 1e18 / ownval < collateral[i].ratios[flutter]) {
          portions++;
        }
      }

      for (uint256 i = 0; i < collateral.length; i++) {
        uint256 collateralval = IERC20Upgradeable(collateral[i].token).balanceOf(USSD) * 1e18 / (10**IERC20MetadataUpgradeable(collateral[i].token).decimals()) * collateral[i].oracle.getPriceUSD() / 1e18;
        if (collateralval * 1e18 / ownval < collateral[i].ratios[flutter]) {
          if (collateral[i].pathbuy.length > 0) {
            // don't touch DAI if it's needed to be bought (it's already bought)
            IUSSD(USSD).UniV3SwapInput(collateral[i].pathbuy, daibought/portions);
          }
        }
      }
    }
}
