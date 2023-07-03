// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./UniswapV3StaticOracle.sol";

import "../interfaces/IStableOracle.sol";
import "../interfaces/IStaticOracle.sol";

/*
    Oracle for DAI using WETH/DAI UniV3 pools (this could also use several DEX pools)
    
    curve DAI 3pool 0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7 (400m TVL) -- to other stables
    curve tricrypto2 0xd51a44d3fae010294c616388b506acda1bfaae46 (200m TVL) -- to ETH, to BTC
    uniswap DAI/ETH 0x60594a405d53811d3bc4766596efd80fd545a270 (200m TVL) -- to ETH
    0x773616e4d11a78f511299002da57a0a94577f1f4 Chainlink DAI/ETH feed
*/
contract StableOracleDAI is IStableOracle {
    AggregatorV3Interface public immutable priceFeedDAIETH;
    IStaticOracle public immutable staticOracleUniV3;
    IStableOracle public immutable ethOracle;

    // as is uses DEX to get DAI/WETH price, stable oracle WETH address is required to keep it based to USD
    constructor(address _wethoracle) {
        priceFeedDAIETH = AggregatorV3Interface(
            0x773616E4d11A78F511299002da57A0a94577F1f4
        );
        staticOracleUniV3 = IStaticOracle(
            0xB210CE856631EeEB767eFa666EC7C1C57738d438 // Mean finance static oracle on mainnet
        );
        ethOracle = IStableOracle(_wethoracle);
    }

    function getPriceUSD() external view override returns (uint256) {
        address[] memory pools = new address[](1);
        pools[0] = 0x60594a405d53811d3BC4766596EFD80fd545A270;
        uint256 WETHDAIDexPrice = staticOracleUniV3.quoteSpecificPoolsWithTimePeriod(
            1000000000000000000, // 1 Eth
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, // WETH (base token)
            0x6B175474E89094C44Da98b954EedeAC495271d0F, // DAI (quote token)
            pools, // DAI/WETH pool uni v3
            600 // period
        );

        uint256 WETHUSDFeedPrice = ethOracle.getPriceUSD();

        // chainlink price data is 18 decimals for DAI/ETH, so multiply by 10 decimals to get 18 decimal fractional
        //(uint80 roundID, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) = priceFeedDAIETH.latestRoundData();
        (, int256 price, , uint256 updatedAt, ) = priceFeedDAIETH.latestRoundData();
        require(updatedAt > block.timestamp - 86400, "stall");

        // flip the fraction
        uint256 WETHDAIFeedPrice = 1e36 / uint256(price);

        // this is debatable: if using of 2 WETH/DAI separate sources safer by averaging or increase the risk of malfunction
        // (more sources of failure)? Anyway, oracles should be monitored during first time at least and are replaceable
        // it also could be possibly reasonable to switch to using DAI as the base valuation instead of USD for current composition
        return
            (WETHUSDFeedPrice * 1e18) /
            ((WETHDAIDexPrice + WETHDAIFeedPrice) / 2);
    }
}
