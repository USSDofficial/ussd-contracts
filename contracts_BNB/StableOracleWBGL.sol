// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./UniswapV3StaticOracle.sol";

import "../interfaces/IStableOracle.sol";
import "../interfaces/IStaticOracle.sol";

contract StableOracleWBGL is IStableOracle {
    IStaticOracle public immutable staticOracleUniV3;
    IStableOracle public immutable ethOracle;

    constructor(address _wethoracle) {
        staticOracleUniV3 = IStaticOracle(
            0xB210CE856631EeEB767eFa666EC7C1C57738d438 // Mean finance static oracle on mainnet
        );
        ethOracle = IStableOracle(_wethoracle);
    }

    function getPriceUSD() external view override returns (uint256) {
        address[] memory pools = new address[](1);
        pools[0] = 0x30075A5c341305a13739A71b6FaF388B294F62e4;
        uint256 USDTWBGLPrice = staticOracleUniV3
            .quoteSpecificPoolsWithTimePeriod(
                1000000000000000000, // 1 USDT
                0x55d398326f99059fF775485246999027B3197955, // USDT (base token)
                0x2bA64EFB7A4Ec8983E22A49c81fa216AC33f383A, // WBGL (quote token)
                pools, // WBGL/WETH pool uni v3
                1 // period
            );

        //uint256 WETHPriceUSD = ethOracle.getPriceUSD();

        //return (WETHPriceUSD * 1e18) / WBGLWETHPrice;

        return 1e36 / USDTWBGLPrice;
    }
}
