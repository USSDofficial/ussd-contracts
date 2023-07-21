// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../interfaces/IStableOracle.sol";

/*
    wbtc 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    chainlink btc/usd priceFeed 0xf4030086522a5beea4988f8ca5b36dbc97bee88c;
*/
contract StableOracleWBTC is IStableOracle {
    AggregatorV3Interface public immutable priceFeed;

    constructor() {
        priceFeed = AggregatorV3Interface(
            0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
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
