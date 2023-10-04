// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../interfaces/IStableOracle.sol";

contract StableOracleWBTC is IStableOracle {
    AggregatorV3Interface public immutable priceFeed;

    constructor() {
        priceFeed = AggregatorV3Interface(
            0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf
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
