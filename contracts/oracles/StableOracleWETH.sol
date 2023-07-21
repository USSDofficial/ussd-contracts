// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../interfaces/IStableOracle.sol";

/*
    weth 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    chainlink weth/usd priceFeed 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
*/
contract StableOracleWETH is IStableOracle {
    AggregatorV3Interface public immutable priceFeed;

    constructor() {
        priceFeed = AggregatorV3Interface(
            0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
        );
    }

    function getPriceUSD() external view override returns (uint256) {
        //(uint80 roundID, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();
        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        require(updatedAt > block.timestamp - 7200, "stall");

        // chainlink price data is 8 decimals for WETH/USD
        return uint256(price) * 1e10;
    }
}
