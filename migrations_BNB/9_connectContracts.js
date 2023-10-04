const USSD = artifacts.require('USSD');
const USSDRebalancer = artifacts.require('USSDRebalancer');
const UniV3LiqCalculator = artifacts.require("UniV3LiqCalculator");

const StableOracleWETH = artifacts.require("StableOracleWETH");
const StableOracleWBGL = artifacts.require("StableOracleWBGL");
const StableOracleUSDT = artifacts.require("StableOracleUSDT");
const StableOracleWBTC = artifacts.require("StableOracleWBTC");

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
    //0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e Eth USD
    //0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf BTC USD
    
    const USDT = '0x55d398326f99059fF775485246999027B3197955';  // Binange-peg USDT
    const WETH = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'; // Binance-peg ETH token
    const WBTC = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'; // BTCB
    const WBGL = '0x2bA64EFB7A4Ec8983E22A49c81fa216AC33f383A'; // WBGL

    // WBGL-DAI UniV3 0.05% 0xe1686237355a380A0E3414c5E8d1b5f59d60f97F
    // direct swap WBGL <-> DAI
    
    // BTCB-WBNB 0.05% 0x28dF0835942396B7a1b7aE1cd068728E6ddBbAfD
    // WETH-WBNB 0.05% 0x0f338Ec12d3f7C3D77A4B9fcC1f95F3FB6AD0EA6

    // https://info.uniswap.org/#/bnb/pools/0x6fe9e9de56356f7edbfcbb29fab7cd69471a4869
    // USDT-WBNB 0.05% 0x6fe9e9de56356f7edbfcbb29fab7cd69471a4869

    const USSD_instance = await USSD.deployed();
    const USSDRebalancer_instance = await USSDRebalancer.deployed();
    const UniV3LiqCalculator_instance = await UniV3LiqCalculator.deployed();

    const StableOracleUSDT_instance = await StableOracleUSDT.deployed();
    const StableOracleWETH_instance = await StableOracleWETH.deployed();
    const StableOracleWBTC_instance = await StableOracleWBTC.deployed();
    const StableOracleWBGL_instance = await StableOracleWBGL.deployed();

    console.log("Connecting contracts");
    console.log("------------------------------------------------------------------------------");
    console.log("USSD deployed at: " + USSD_instance.address);
    console.log("USSD rebalancer deployed at: " + USSDRebalancer_instance.address);
    console.log("USSD rebalancer UniV3Calc deployed at: " + UniV3LiqCalculator_instance.address);
    console.log("USDT oracle deployed at: " + StableOracleUSDT_instance.address);
    console.log("WETH oracle deployed at: " + StableOracleWETH_instance.address);
    console.log("WBTC oracle deployed at: " + StableOracleWBTC_instance.address);
    console.log("WBGL oracle deployed at: " + StableOracleWBGL_instance.address);

    await USSD_instance.grantRole.sendTransaction(web3.utils.sha3("STABLE_CONTROL_ROLE"), accounts[0], { from: accounts[0] });
    console.log("Granted STABLE_CONTROL_ROLE role on USSD to deployer at " + accounts[0]);

    await USSDRebalancer_instance.grantRole.sendTransaction(web3.utils.sha3("STABLE_CONTROL_ROLE"), accounts[0], { from: accounts[0] });
    console.log("Granted STABLE_CONTROL_ROLE role on USSD Rebalancer to deployer at " + accounts[0]);

    // USSD routes to USDT

    path_USDT_USSD = "0x" + "55d398326f99059fF775485246999027B3197955" //USDT
      + "000064" // 0.01% tier (low-risk)
      + USSD_instance.address.substring(2)

    path_USSD_USDT = "0x" + USSD_instance.address.substring(2)
      + "000064" // 0.01% tier (low-risk)
      + "55d398326f99059fF775485246999027B3197955" //USDT

    // WETH routes to USDT

    path_WETH_WBNB_USDT = "0x" + "2170Ed0880ac9A755fd29B2688956BD959F933F8" //WETH
      + "0001f4" // 0.05% tier (medium-risk)
      + "bb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" //WBNB
      + "0001f4" // 0.05% tier (medium-risk)
      + "55d398326f99059fF775485246999027B3197955" //USDT

    path_USDT_WBNB_WETH = "0x" + "55d398326f99059fF775485246999027B3197955" //USDT
      + "0001f4" // 0.05% tier (medium-risk)
      + "bb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" //WBNB
      + "0001f4" // 0.05% tier (medium-risk)
      + "2170Ed0880ac9A755fd29B2688956BD959F933F8" //WETH

    // WETH routes to USDT

    path_WBTC_WBNB_USDT = "0x" + "7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" //WBTC
      + "0001f4" // 0.05% tier (medium-risk)
      + "bb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" //WBNB
      + "0001f4" // 0.05% tier (medium-risk)
      + "55d398326f99059fF775485246999027B3197955" //USDT

    path_USDT_WBNB_WBTC = "0x" + "55d398326f99059fF775485246999027B3197955" //USDT
      + "0001f4" // 0.05% tier (medium-risk)      
      + "bb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" //WBNB
      + "0001f4" // 0.05% tier (medium-risk)  
      + "7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" //WBTC
    
    // WBGL routes to USDT

    path_WBGL_USDT = "0x" + "2ba64efb7a4ec8983e22a49c81fa216ac33f383a" //WBGL
      + "0001f4" // 0.05% tier
      + "55d398326f99059fF775485246999027B3197955" //USDT
      
    path_USDT_WBGL = "0x" + "55d398326f99059fF775485246999027B3197955" //USDT
      + "0001f4" // 0.05% tier      
      + "2ba64efb7a4ec8983e22a49c81fa216ac33f383a" //WBGL

    await USSD_instance.addCollateral(USDT, StableOracleUSDT_instance.address, true, true, 
      [web3.utils.toBN('250000000000000000'), web3.utils.toBN('350000000000000000'), web3.utils.toBN('1000000000000000000'), web3.utils.toBN('800000000000000000')],
      '0x', '0x', 100);
    await USSD_instance.addCollateral(WETH, StableOracleWETH_instance.address, false, false, 
      [web3.utils.toBN('2000000000000000000'), web3.utils.toBN('4000000000000000000'), web3.utils.toBN('5000000000000000000'), web3.utils.toBN('6000000000000000000')], 
      path_USDT_WBNB_WETH, path_WETH_WBNB_USDT, 100);
    await USSD_instance.addCollateral(WBTC, StableOracleWBTC_instance.address, false, false, 
      [web3.utils.toBN('2000000000000000000'), web3.utils.toBN('4000000000000000000'), web3.utils.toBN('5000000000000000000'), web3.utils.toBN('6000000000000000000')], 
      path_USDT_WBNB_WBTC, path_WBTC_WBNB_USDT, 100);
    await USSD_instance.addCollateral(WBGL, StableOracleWBGL_instance.address, false, false, 
      [web3.utils.toBN('10000000000000000000'), web3.utils.toBN('20000000000000000000'), web3.utils.toBN('50000000000000000000'), web3.utils.toBN('100000000000000000000')], 
      path_USDT_WBGL, path_WBGL_USDT, 100);

    console.log("Added 4 collaterals to USSD");

    await USSDRebalancer_instance.setBaseAsset(USDT, { from: accounts[0] });
    console.log("Set base asset as USDT " + USDT + " on rebalancer");

    const SWAP_ROUTER_ADDRESS = '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2';
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
  
    await USSD_instance.approveToRouter(USSD_instance.address, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved USSD to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(USDT, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved USDT to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(WETH, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved WETH to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(WBTC, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved WBTC to be traded by router from USSD contract`);

    await USSD_instance.approveToRouter(WBGL, web3.utils.toBN('1000000000000000000000000000000000000'));
    console.log(`Approved WBGL to be traded by router from USSD contract`);
};
