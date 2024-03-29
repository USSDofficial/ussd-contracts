// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./UniswapV3StaticOracle.sol";

import "../interfaces/IStableOracle.sol";
import "../interfaces/IStaticOracle.sol";

/* 
    wbgl 0x2bA64EFB7A4Ec8983E22A49c81fa216AC33f383A;
    wbgl/weth uni v3 0x982152A6C7f732Ec7C9EA998dDD9Ebde00Dfa16e
*/
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
        pools[0] = 0x982152A6C7f732Ec7C9EA998dDD9Ebde00Dfa16e;
        uint256 WBGLWETHPrice = staticOracleUniV3
            .quoteSpecificPoolsWithTimePeriod(
                1000000000000000000, // 1 Eth
                0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, // WETH (base token)
                0x2bA64EFB7A4Ec8983E22A49c81fa216AC33f383A, // WBGL (quote token)
                pools, // WBGL/WETH pool uni v3
                600 // period
            );

        uint256 WETHPriceUSD = ethOracle.getPriceUSD();

        return (WETHPriceUSD * 1e18) / WBGLWETHPrice;
    }
}
