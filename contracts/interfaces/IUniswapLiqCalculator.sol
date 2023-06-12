// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface IUniswapLiqCalculator {
    function calculateAmountTillPriceMatch(address pool, uint160 targetPriceX96) external view returns (int256);
}

