const USSD = artifacts.require('USSD');
const USSDRebalancer = artifacts.require('USSDRebalancer');
const UniV3LiqCalculator = artifacts.require("UniV3LiqCalculator");

const StableOracleWETH = artifacts.require("StableOracleWETH");
const StableOracleWBGL = artifacts.require("StableOracleWBGL");
const StableOracleDAI = artifacts.require("StableOracleDAI");
const StableOracleWBTC = artifacts.require("StableOracleWBTC");

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
    const WBGL = '0x2bA64EFB7A4Ec8983E22A49c81fa216AC33f383A';

    const USSD_instance = await USSD.deployed();
    const USSDRebalancer_instance = await USSDRebalancer.deployed();
    const UniV3LiqCalculator_instance = await UniV3LiqCalculator.deployed();

    const StableOracleDAI_instance = await StableOracleDAI.deployed();
    const StableOracleWETH_instance = await StableOracleWETH.deployed();
    const StableOracleWBTC_instance = await StableOracleWBTC.deployed();
    const StableOracleWBGL_instance = await StableOracleWBGL.deployed();

    console.log("Connecting contracts");
    console.log("------------------------------------------------------------------------------");
    console.log("USSD deployed at: " + USSD_instance.address);
    console.log("USSD rebalancer deployed at: " + USSDRebalancer_instance.address);
    console.log("USSD rebalancer UniV3Calc deployed at: " + UniV3LiqCalculator_instance.address);
    console.log("DAI oracle deployed at: " + StableOracleDAI_instance.address);
    console.log("WETH oracle deployed at: " + StableOracleWETH_instance.address);
    console.log("WBTC oracle deployed at: " + StableOracleWBTC_instance.address);
    console.log("WBGL oracle deployed at: " + StableOracleWBGL_instance.address);

    await USSD_instance.grantRole.sendTransaction(web3.utils.sha3("STABLECONTROL"), accounts[0], { from: accounts[0] });
    console.log("Granded STABLECONTROL role on USSD to deployer at " + accounts[0]);

    await USSDRebalancer_instance.grantRole.sendTransaction(web3.utils.sha3("STABLECONTROL"), accounts[0], { from: accounts[0] });
    console.log("Granded STABLECONTROL role on USSD Rebalancer to deployer at " + accounts[0]);

    const path_DAI_USSD = "0x" + "6b175474e89094c44da98b954eedeac495271d0f" //DAI
        + "000064" // 0.01% tier (low-risk)
        + USSD_instance.address.substring(2)

    const path_USSD_DAI = "0x" + USSD_instance.address.substring(2)
        + "000064" // 0.01% tier (low-risk)
        + "6b175474e89094c44da98b954eedeac495271d0f" //DAI

    const path_WETH_USDC_DAI = "0x" + "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" //WETH
        + "0001f4" // 0.05% tier (medium-risk)
        + "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" //USDC
        + "000064" // 0.01% tier (low-risk)
        + "6b175474e89094c44da98b954eedeac495271d0f" //DAI

    const path_DAI_USDC_WETH = "0x" + "6b175474e89094c44da98b954eedeac495271d0f" //DAI
        + "000064" // 0.05% tier (medium-risk)
        + "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" //USDC
        + "0001f4" // 0.01% tier (low-risk)
        + "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" //WETH

    const path_WBTC_WETH_USDC_DAI = "0x" + "2260fac5e5542a773aa44fbcfedf7c193bc2c599" //WBTC
        + "000bb8" // 0.3% tier 
        + "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" //WETH
        + "0001f4" // 0.05% tier (medium-risk)
        + "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" //USDC
        + "000064" // 0.01% tier (low-risk)
        + "6b175474e89094c44da98b954eedeac495271d0f" //DAI

    const path_DAI_USDC_WETH_WBTC = "0x" + "6b175474e89094c44da98b954eedeac495271d0f" //DAI
        + "000064" // 0.01% tier (low-risk)
        + "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" //USDC
        + "0001f4" // 0.05% tier (medium-risk)      
        + "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" //WETH
        + "000bb8" // 0.3% tier 
        + "2260fac5e5542a773aa44fbcfedf7c193bc2c599" //WBTC
        
    const path_WBGL_WETH_USDC_DAI = "0x" + "2ba64efb7a4ec8983e22a49c81fa216ac33f383a" //WBGL
        + "000064" // 0.01% tier 
        + "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" //WETH
        + "0001f4" // 0.05% tier
        + "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" //USDC
        + "000064" // 0.01% tier
        + "6b175474e89094c44da98b954eedeac495271d0f" //DAI
        
    const path_DAI_USDC_WETH_WBGL = "0x" + "6b175474e89094c44da98b954eedeac495271d0f" //DAI
        + "000064" // 0.01% tier
        + "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" //USDC
        + "0001f4" // 0.05% tier      
        + "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" //WETH
        + "000064" // 0.01% tier
        + "2ba64efb7a4ec8983e22a49c81fa216ac33f383a" //WBGL

    await USSD_instance.addCollateral(DAI, StableOracleDAI_instance.address, true, true, 
        [web3.utils.toBN('250000000000000000'), web3.utils.toBN('350000000000000000'), web3.utils.toBN('1000000000000000000'), web3.utils.toBN('800000000000000000')],
        '0x', '0x', 100);
    await USSD_instance.addCollateral(WETH, StableOracleWETH_instance.address, false, false, 
        [web3.utils.toBN('2000000000000000000'), web3.utils.toBN('4000000000000000000'), web3.utils.toBN('5000000000000000000'), web3.utils.toBN('6000000000000000000')], 
        path_DAI_USDC_WETH, path_WETH_USDC_DAI, 100);
    await USSD_instance.addCollateral(WBTC, StableOracleWBTC_instance.address, false, false, 
        [web3.utils.toBN('2000000000000000000'), web3.utils.toBN('4000000000000000000'), web3.utils.toBN('5000000000000000000'), web3.utils.toBN('6000000000000000000')], 
        path_DAI_USDC_WETH_WBTC, path_WBTC_WETH_USDC_DAI, 100);
    await USSD_instance.addCollateral(WBGL, StableOracleWBGL_instance.address, false, false, 
        [web3.utils.toBN('10000000000000000000'), web3.utils.toBN('20000000000000000000'), web3.utils.toBN('50000000000000000000'), web3.utils.toBN('100000000000000000000')], 
        path_DAI_USDC_WETH_WBGL, path_WBGL_WETH_USDC_DAI, 100);

    console.log("Added 4 collaterals to USSD");

    await USSDRebalancer_instance.setBaseAsset(DAI, { from: accounts[0] });
    console.log("Set base asset as " + DAI + " on rebalancer");

    const SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
    await USSD_instance.setUniswapRouter(SWAP_ROUTER_ADDRESS);
    console.log("Set UniV3 universtal router as " + SWAP_ROUTER_ADDRESS + " on USSD contract");

    // add collateral and set flutter ratios for USSD
    // 14.25, 28.35, 61, 112.8 according to whitepaper
    await USSDRebalancer_instance.setFlutterRatios([web3.utils.toBN('14250000000000000000'), web3.utils.toBN('28350000000000000000'), web3.utils.toBN('61000000000000000000'), web3.utils.toBN('112800000000000000000')], { from: accounts[0] });
    console.log("Set flutter ratios on USSD Rebalancer contract");

    await USSDRebalancer_instance.setUniswapCalculator(UniV3LiqCalculator_instance.address, { from: accounts[0] });  
    console.log(`Added UniV3 calculator address to USSD Rebalancer contract`);

    await USSD_instance.setRebalancer(USSDRebalancer_instance.address);
    console.log(`Added Rebalancer address to USSD contract`);
   
    await USSD_instance.approveToRouter(DAI, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved DAI to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(USSD_instance.address, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved USSD to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(WETH, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved WETH to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(WBTC, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved WBTC to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(WBGL, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved WBGL to be traded by router from USSD contract`);
};
