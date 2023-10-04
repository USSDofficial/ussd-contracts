const { expect } = require('chai');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { time } = require('@openzeppelin/test-helpers');

const { SupportedChainId, Percent, Token, CurrencyAmount, TradeType } = require('@uniswap/sdk-core');

const { computePoolAddress, SwapQuoter, Pool, Route } = require('@uniswap/v3-sdk');
const { FeeAmount } = require('@uniswap/v3-sdk');

const { ethers } = require("ethers");

const {
    AlphaRouter,
    ChainId,
    SwapType,
  } = require('@uniswap/smart-order-router');

const USSD = artifacts.require('USSD');
const USSDRebalancer = artifacts.require('USSDRebalancer');
const UNICALC = artifacts.require('UniV3LiqCalculator');
const SimOracle = artifacts.require('SimOracle'); // these are mock oracles used for simulation run

const StableOracleWBTC = artifacts.require('StableOracleWBTC');
const StableOracleWETH = artifacts.require('StableOracleWETH');
const StableOracleUSDT = artifacts.require('StableOracleUSDT');
const StableOracleWBGL = artifacts.require('StableOracleWBGL');


contract('USSD', function (accounts) {
  beforeEach(async function () {
    this.USSD = await deployProxy(USSD, ["US Secured Dollar", "USSD"], { from: accounts[0] });
  });
 
  it('has oracle prices returning expected values', async function() {
    this.OBTC = await StableOracleWBTC.new({ from: accounts[0] });
    this.OWETH = await StableOracleWETH.new({ from: accounts[0] });
    // these two oracles use DEX data and require WETH oracle address in constructor
    this.OUSDT = await StableOracleUSDT.new(this.OWETH.address, { from: accounts[0] });
    this.OWBGL = await StableOracleWBGL.new(this.OWETH.address, { from: accounts[0] });

    let BTCprice = await this.OBTC.getPriceUSD({ from: accounts[0] });
    console.log(`Oracle reported WBTC price: ${BTCprice}`);

    let WETHprice = await this.OWETH.getPriceUSD({ from: accounts[0] });
    console.log(`Oracle reported WETH price: ${WETHprice}`);

    let USDTprice = await this.OUSDT.getPriceUSD({ from: accounts[0] });
    console.log(`Oracle reported USDT price: ${USDTprice}`);

    let WBGLprice = await this.OWBGL.getPriceUSD({ from: accounts[0] });
    console.log(`Oracle reported WBGL price: ${WBGLprice}`);
  }),

  it('able to create pool, add collateral and rebalance itself (simulation)', async function () {
    expect((await this.USSD.totalSupply()).toString()).to.equal('1000000000'); // 1000 USSD minted

    let checkBalance = await web3.eth.getBalance(accounts[0]);
    console.log(`BNB balance on ${accounts[0]} is ${checkBalance}`)

    const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const WBNBABI = '[{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"guy","type":"address"},{"name":"wad","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"src","type":"address"},{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"guy","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"}]';

    let WBNBContract = new web3.eth.Contract(JSON.parse(WBNBABI), WBNB);
    await WBNBContract.methods.deposit().send({value: web3.utils.toBN('30000000000000000000'), from: accounts[0] }, function(error, result) {
        console.log(`converted (wrapped) 30 BNB to WBNB: ${result}`);
      });

    // get WETH
    await WBNBContract.methods.balanceOf(accounts[0]).call(function(error, result) {
      console.log(`WBNB balance of ${accounts[0]}: ${result}`);
    });

    // get USDT
    const USDT = '0x55d398326f99059fF775485246999027B3197955';
    const USDTABI = '[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[],"name":"_decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
    let USDTContract = new web3.eth.Contract(JSON.parse(USDTABI), USDT);

    // https://docs.uniswap.org/sdk/v3/guides/routing
    // Note that routing is not supported for local forks, so we will use a mainnet provider even when swapping on a local fork
    let bscProvider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed2.bnbchain.org")

    const router = new AlphaRouter({
      chainId: ChainId.BSC,
      provider: bscProvider,
    })

    const options = {
      recipient: accounts[0],
      slippageTolerance: new Percent(50, 10_000),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    }
    
    const USDT_TOKEN = new Token(
      SupportedChainId.BNB,
      '0x55d398326f99059fF775485246999027B3197955',
      18,
      'USDT',
      'Binance-Peg BSC-USD (BSC-USD)'
    )
    
    const WBNB_TOKEN = new Token(
      SupportedChainId.BNB,
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      18,
      'WBNB',
      'Wrapped BNB (WBNB)'
    )

    const route = await router.route(
      CurrencyAmount.fromRawAmount(
        WBNB_TOKEN,
        '25000000000000000000'
      ),
      USDT_TOKEN,
      TradeType.EXACT_INPUT,
      options
    )
      
    console.log("Calculated route to swap WBNB to USDT");

    await WBNBContract.methods.approve(route.methodParameters.to, web3.utils.toBN('25000000000000000000')).send({ from: accounts[0] }, function(error, result) {
      console.log(`approved WBNB to address ${route.methodParameters.to}: ${result}`);
    });

    await WBNBContract.methods.balanceOf(accounts[0]).call(function(error, result) {
      console.log(`WBNB balance of ${accounts[0]}: ${result}`);
    });

    await web3.eth.sendTransaction({
      to: route.methodParameters.to, // contract address
      data: route.methodParameters.calldata,
      from: accounts[0],
      gas: '1000000'
    }, function(error, hash){
      if (error != null) {
        console.log('Error', error);
      }
    });
    console.log("Swapped WBNB to USDT");

    await WBNBContract.methods.balanceOf(accounts[0]).call(function(error, result) {
      console.log(`WBNB balance of ${accounts[0]}: ${result}`);
    });

    await USDTContract.methods.balanceOf(accounts[0]).call(function(error, result) {
      console.log(`USDT balance of ${accounts[0]}: ${result}`);
    });

    await this.USSD.grantRole.sendTransaction(web3.utils.sha3("STABLE_CONTROL_ROLE"), accounts[0], { from: accounts[0] });

    console.log("Granted STABLECONTROL role on USSD to deployer");

    const WBTC = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c';
    const WBTCABI = '[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[],"name":"_decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
    let WBTCContract = new web3.eth.Contract(JSON.parse(WBTCABI), WBTC);

    const WBGL = '0x2bA64EFB7A4Ec8983E22A49c81fa216AC33f383A';
    const WBGLABI = '[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MINTER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PAUSER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"cap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"totalSupply","type":"uint256"},{"internalType":"address","name":"owner","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"}]';
    let WBGLContract = new web3.eth.Contract(JSON.parse(WBGLABI), WBGL);

    const WETH = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8';
    const WETHABI = '[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[],"name":"_decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"_symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
    let WETHContract = new web3.eth.Contract(JSON.parse(WETHABI), WETH);


    this.oracleUSDT = await SimOracle.new(web3.utils.toBN('1000000000000000000'), { from: accounts[0] });
    this.oracleWBTC = await SimOracle.new(web3.utils.toBN('30000000000000000000000'), { from: accounts[0] });
    this.oracleWETH = await SimOracle.new(web3.utils.toBN('2000000000000000000000'), { from: accounts[0] });
    this.oracleWBGL = await SimOracle.new(web3.utils.toBN('300000000000000000'), { from: accounts[0] });

    // USSD routes to USDT

    path_USDT_USSD = "0x" + "55d398326f99059fF775485246999027B3197955" //USDT
      + "000064" // 0.01% tier (low-risk)
      + this.USSD.address.substring(2)

    path_USSD_USDT = "0x" + this.USSD.address.substring(2)
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

    await this.USSD.addCollateral(USDT, this.oracleUSDT.address, true, true, 
      [web3.utils.toBN('250000000000000000'), web3.utils.toBN('350000000000000000'), web3.utils.toBN('1000000000000000000'), web3.utils.toBN('800000000000000000')],
      '0x', '0x', 100);
    await this.USSD.addCollateral(WETH, this.oracleWETH.address, false, false, 
      [web3.utils.toBN('2000000000000000000'), web3.utils.toBN('4000000000000000000'), web3.utils.toBN('5000000000000000000'), web3.utils.toBN('6000000000000000000')], 
      path_USDT_WBNB_WETH, path_WETH_WBNB_USDT, 100);
    await this.USSD.addCollateral(WBTC, this.oracleWBTC.address, false, false, 
      [web3.utils.toBN('2000000000000000000'), web3.utils.toBN('4000000000000000000'), web3.utils.toBN('5000000000000000000'), web3.utils.toBN('6000000000000000000')], 
      path_USDT_WBNB_WBTC, path_WBTC_WBNB_USDT, 100);
    await this.USSD.addCollateral(WBGL, this.oracleWBGL.address, false, false, 
      [web3.utils.toBN('10000000000000000000'), web3.utils.toBN('20000000000000000000'), web3.utils.toBN('50000000000000000000'), web3.utils.toBN('100000000000000000000')], 
      path_USDT_WBGL, path_WBGL_USDT, 100);
  
    console.log("Added USSD collaterals");

    // create a USSD/USDT pool in Uni V3
    const POOL_FACTORY_CONTRACT_ADDRESS = '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7'
    const NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS = '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613'

    // approve USSD
    let resapprove = await this.USSD.approve(NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, web3.utils.toBN('10000000000'), { from: accounts[0] });
    console.log(`approved USSD to address ${NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS}: ${resapprove}`);

    // approve USDT
    await USDTContract.methods.approve(NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, web3.utils.toBN('10000000000000000000000')).send({ from: accounts[0] }, function(error, result) {
      console.log(`approved USDT to address ${NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS}: ${result}`);
    });

    const USSD_TOKEN = new Token(
      SupportedChainId.BNB,
      this.USSD.address,
      6,
      'USSD',
      'US Secured Dollar'
    )

    const currentPoolAddress = computePoolAddress({
      factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
      tokenA: USSD_TOKEN,
      tokenB: USDT_TOKEN,
      fee: FeeAmount.LOWEST,
    })

    console.log("Computed USSD/USDT pool address: ", currentPoolAddress);

    UniV3MgrABI = '[{"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH9","type":"address"},{"internalType":"address","name":"_tokenDescriptor_","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Collect","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"uint128","name":"liquidity","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"DecreaseLiquidity","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"uint128","name":"liquidity","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"IncreaseLiquidity","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PERMIT_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"WETH9","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"baseURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint128","name":"amount0Max","type":"uint128"},{"internalType":"uint128","name":"amount1Max","type":"uint128"}],"internalType":"struct INonfungiblePositionManager.CollectParams","name":"params","type":"tuple"}],"name":"collect","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"}],"name":"createAndInitializePoolIfNecessary","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"amount0Min","type":"uint256"},{"internalType":"uint256","name":"amount1Min","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"internalType":"struct INonfungiblePositionManager.DecreaseLiquidityParams","name":"params","type":"tuple"}],"name":"decreaseLiquidity","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"amount0Desired","type":"uint256"},{"internalType":"uint256","name":"amount1Desired","type":"uint256"},{"internalType":"uint256","name":"amount0Min","type":"uint256"},{"internalType":"uint256","name":"amount1Min","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"internalType":"struct INonfungiblePositionManager.IncreaseLiquidityParams","name":"params","type":"tuple"}],"name":"increaseLiquidity","outputs":[{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint256","name":"amount0Desired","type":"uint256"},{"internalType":"uint256","name":"amount1Desired","type":"uint256"},{"internalType":"uint256","name":"amount0Min","type":"uint256"},{"internalType":"uint256","name":"amount1Min","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"internalType":"struct INonfungiblePositionManager.MintParams","name":"params","type":"tuple"}],"name":"mint","outputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"}],"name":"multicall","outputs":[{"internalType":"bytes[]","name":"results","type":"bytes[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"positions","outputs":[{"internalType":"uint96","name":"nonce","type":"uint96"},{"internalType":"address","name":"operator","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"feeGrowthInside0LastX128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthInside1LastX128","type":"uint256"},{"internalType":"uint128","name":"tokensOwed0","type":"uint128"},{"internalType":"uint128","name":"tokensOwed1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"refundETH","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowed","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitAllowedIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"selfPermitIfNecessary","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"sweepToken","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount0Owed","type":"uint256"},{"internalType":"uint256","name":"amount1Owed","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"uniswapV3MintCallback","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountMinimum","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"unwrapWETH9","outputs":[],"stateMutability":"payable","type":"function"},{"stateMutability":"payable","type":"receive"}]';

    USSDFirst = true;

    // uniswap address (!) of token0 must be less than address of token1
    // require(token0 < token1);
    // please refer to Uniswap V3 Book uniswapv3book.com for details on tick math, etc.
    let token0 = this.USSD.address.toLowerCase().substring(2);
    let token1 = USDT.toLowerCase().substring(2);
    //let amount0 = "00000000000000000000000000000000000000000000000000000002540BE400";
    //let amount1 = "00000000000000000000000000000000000000000000021E19E0C9BAB2400000";
    let amount0 = "000000000000000000000000000000000000000000000000000000003B9ACA00";
    let amount1 = "00000000000000000000000000000000000000000000003635C9ADC5DEA00000";
    let minamount0 = "0000000000000000000000000000000000000000000000000000000000000000";
    let minamount1 = "0000000000000000000000000000000000000000000000000000000000000000";
    let sqrtPriceX96 = "00000000000000000000000000000000000F4240000000000000000000000000"; // 1000000000000000000 / 1000000 sqrt(y/x), price = 1e12, 1 USSD = 1 USDT
    let tickLower = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff29280"; // tick lower
    let tickUpper = "00000000000000000000000000000000000000000000000000000000000d6d80"; // tick upper

    if (this.USSD.address.toLowerCase().substring(2) > USDT.toLowerCase().substring(2)) {
      USSDFirst = false;
      console.log("USDT token is token 0 in pool");
      token0 = USDT.toLowerCase().substring(2);
      token1 = this.USSD.address.toLowerCase().substring(2);
      //amount0 = "00000000000000000000000000000000000000000000021E19E0C9BAB2400000";
      //amount1 = "00000000000000000000000000000000000000000000000000000002540BE400";
      amount0 = "00000000000000000000000000000000000000000000003635C9ADC5DEA00000";
      amount1 = "000000000000000000000000000000000000000000000000000000003B9ACA00";
      minamount0 = "0000000000000000000000000000000000000000000000000000000000000000";
      minamount1 = "0000000000000000000000000000000000000000000000000000000000000000";
      sqrtPriceX96 = "0000000000000000000000000000000000000000000010C6F7A0B5ED8D36B4C7"; // 1000000 / 1000000000000000000 sqrt(y/x), price = 1e-12, 1 USDT = 1 USSD
      tickLower = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff29280"; // tick lower 0.01 * 1e-12 = 0.00000000000001
      tickUpper = "00000000000000000000000000000000000000000000000000000000000d6d80"; // tick upper 100 * 1e-12 =  0.00000000100
    } else {
      console.log("USSD token is token 0 in pool");
    }

    let multiCallParams = [
      // first call
      "0x13ead562" + // encoded function signature ( createAndInitializePoolIfNecessary(address, address, uint24, uint160) )
      "000000000000000000000000" + token0 + // token1 address
      "000000000000000000000000" + token1 + // token2 address
      "0000000000000000000000000000000000000000000000000000000000000064" + // fee
      sqrtPriceX96, // sqrtPriceX96
      // second call
      "0x88316456" + // encoded function signature ( mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256)) )
      "000000000000000000000000" + token0 + // token1 address
      "000000000000000000000000" + token1 + // token2 address
      "0000000000000000000000000000000000000000000000000000000000000064" + // fee
      tickLower +
      tickUpper +
      amount0 + // amount 1 desired 10000
      amount1 + // amount 2 desired 10000
      minamount0 + // min amount 1 expected
      minamount1 + // min amount 2 expected 
      "000000000000000000000000" + accounts[0].toLowerCase().substring(2) + // deployer address 
      "000000000000000000000000000000000000000000000000000000006a380911" // deadline
    ];

    let params = web3.eth.abi.encodeParameters(['bytes[]'], [multiCallParams]);

    console.log("Pool creation tx data: 0xac9650d8" + params.substring(2));

    await time.advanceBlock();

    let txhash;
    await web3.eth.sendTransaction({
          to: NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, // UniV3 contract address to create pool
          data: "0xac9650d8" + params.substring(2),
          from: accounts[0],
          gas: '7000000'
        }, function(error, hash){
          if (error != null) {
              console.log('Error', error);
          } else {
              console.log('Pool creation tx hash', hash);
              txhash = hash;
          }
        });
    
    await USDTContract.methods.balanceOf(currentPoolAddress).call(function(error, result) {
      console.log(`USDT balance of USSD/USDT POOL at ${currentPoolAddress}: ${result}`);
    });

    let ussdbalance2 = (await this.USSD.balanceOf(currentPoolAddress));
    console.log(`USSD balance of USSD/USDT POOL is ${ussdbalance2}`);

    let USSDaddr = this.USSD.address;
    await USDTContract.methods.transfer(USSDaddr, web3.utils.toBN('1000000000000000000000')).send({ from: accounts[0] }, function(error, result) {
      console.log(`Transferred 1000 USDT as collateral to USSD at ${USSDaddr}: ${result}`);
    });


    // two main scenarios:
    // 1. peg down recovery
    //    sell collateral (in order), USDT first, to buy USSD from pool and burn
    // 2. peg up rebalance
    //    buy collateral in equal portions appropriate for the collateralization flutter

    // approve USDT to USSD
    await USDTContract.methods.approve(USSDaddr, web3.utils.toBN('100000000000000000000000')).send({ from: accounts[0] }, function(error, result) {
      console.log(`approved USDT to USSD address ${USSDaddr}: ${result}`);
    });

    // mint USSD
    let mint = await this.USSD.mintForToken(USDT, web3.utils.toBN('1000000000000000000000'), accounts[0], { from: accounts[0] });
    console.log(`minted 1000 USSD for 1000 USDT to address ${accounts[0]}: ${mint}`);

    let ussdbalance = (await this.USSD.balanceOf(accounts[0]));
    console.log(`USSD balance of accounts[0] is ${ussdbalance}`);

    const currentPoolAddress2 = computePoolAddress({
      factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
      tokenA: USSD_TOKEN,
      tokenB: USDT_TOKEN,
      fee: FeeAmount.LOWEST,
    })

    console.log("Computed USSD/USDT pool address: ", currentPoolAddress2);

    const UniV3PoolABI = '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"Collect","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"CollectProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid1","type":"uint256"}],"name":"Flash","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextOld","type":"uint16"},{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextNew","type":"uint16"}],"name":"IncreaseObservationCardinalityNext","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Initialize","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"feeProtocol0Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol0New","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1New","type":"uint8"}],"name":"SetFeeProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"int256","name":"amount0","type":"int256"},{"indexed":false,"internalType":"int256","name":"amount1","type":"int256"},{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"uint128","name":"liquidity","type":"uint128"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Swap","type":"event"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collect","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collectProtocol","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fee","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal0X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal1X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"flash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"}],"name":"increaseObservationCardinalityNext","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"liquidity","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxLiquidityPerTick","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"mint","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"observations","outputs":[{"internalType":"uint32","name":"blockTimestamp","type":"uint32"},{"internalType":"int56","name":"tickCumulative","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityCumulativeX128","type":"uint160"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32[]","name":"secondsAgos","type":"uint32[]"}],"name":"observe","outputs":[{"internalType":"int56[]","name":"tickCumulatives","type":"int56[]"},{"internalType":"uint160[]","name":"secondsPerLiquidityCumulativeX128s","type":"uint160[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"positions","outputs":[{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"feeGrowthInside0LastX128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthInside1LastX128","type":"uint256"},{"internalType":"uint128","name":"tokensOwed0","type":"uint128"},{"internalType":"uint128","name":"tokensOwed1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFees","outputs":[{"internalType":"uint128","name":"token0","type":"uint128"},{"internalType":"uint128","name":"token1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint8","name":"feeProtocol0","type":"uint8"},{"internalType":"uint8","name":"feeProtocol1","type":"uint8"}],"name":"setFeeProtocol","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"}],"name":"snapshotCumulativesInside","outputs":[{"internalType":"int56","name":"tickCumulativeInside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityInsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsInside","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"bool","name":"zeroForOne","type":"bool"},{"internalType":"int256","name":"amountSpecified","type":"int256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[{"internalType":"int256","name":"amount0","type":"int256"},{"internalType":"int256","name":"amount1","type":"int256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int16","name":"","type":"int16"}],"name":"tickBitmap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"","type":"int24"}],"name":"ticks","outputs":[{"internalType":"uint128","name":"liquidityGross","type":"uint128"},{"internalType":"int128","name":"liquidityNet","type":"int128"},{"internalType":"uint256","name":"feeGrowthOutside0X128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthOutside1X128","type":"uint256"},{"internalType":"int56","name":"tickCumulativeOutside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityOutsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsOutside","type":"uint32"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';

    let PoolContract = new web3.eth.Contract(JSON.parse(UniV3PoolABI), currentPoolAddress2);

    await PoolContract.methods.token0().call({ from: accounts[0] }, function(error, result) {
      console.log(`token0 address on pool ${currentPoolAddress2}: ${result}`);
    });

    await PoolContract.methods.token1().call({ from: accounts[0] }, function(error, result) {
      console.log(`token1 address on pool ${currentPoolAddress2}: ${result}`);
    });

    let liquidity;
    await PoolContract.methods.liquidity().call({ from: accounts[0] }, function(error, result) {
      console.log(`liquidity on pool ${currentPoolAddress2}: ${result}`);
      liquidity = result;
    });

    let tick;
    let sqrtPriceX96p;
    await PoolContract.methods.slot0().call({ from: accounts[0] }, function(error, result) {
      console.log(`slot0 on pool ${currentPoolAddress2}: ${result}`);
      sqrtPriceX96p = result[0];
      tick = parseInt(result[1], 10);
      console.log(`sqrtPriceX96: ${sqrtPriceX96p}`);
      console.log(`tick: ${tick}`);
    });

    //const SWAP_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
    const SWAP_ROUTER_ADDRESS = '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2';

    let approve = await this.USSD.approve(SWAP_ROUTER_ADDRESS, web3.utils.toBN('1000000000000000000'), { from: accounts[0] });
    console.log(`approved USSD to trade on UniV3 router address ${SWAP_ROUTER_ADDRESS}: ${approve}`);

    await USDTContract.methods.approve(SWAP_ROUTER_ADDRESS, web3.utils.toBN('100000000000000000000000')).send({ from: accounts[0] }, function(error, result) {
      console.log(`approved USDT to SWAP_ROUTER_ADDRESS address ${SWAP_ROUTER_ADDRESS}: ${result}`);
    });

    this.rebalancer = await deployProxy(USSDRebalancer, [this.USSD.address], { from: accounts[0] });
    this.UNICALC = await UNICALC.new({ from: accounts[0] });

    await this.rebalancer.grantRole.sendTransaction(web3.utils.sha3("STABLE_CONTROL_ROLE"), accounts[0], { from: accounts[0] });

    await this.rebalancer.setUniswapCalculator(this.UNICALC.address, { from: accounts[0] });

    // add collateral and set flutter ratios for USSD
    // 14.25, 28.35, 61, 112.8 according to whitepaper
    await this.rebalancer.setFlutterRatios([web3.utils.toBN('14250000000000000000'), web3.utils.toBN('28350000000000000000'), web3.utils.toBN('61000000000000000000'), web3.utils.toBN('112800000000000000000')], { from: accounts[0] });

    await this.rebalancer.setPoolAddress(currentPoolAddress2, { from: accounts[0] });

    await this.rebalancer.setBaseAsset(USDT, { from: accounts[0] });

    let valuation = await this.rebalancer.getOwnValuation({ from: accounts[0] });
    console.log(`USSD rebalancer price valuation is: ${valuation}`);

    await this.USSD.setUniswapRouter(SWAP_ROUTER_ADDRESS);
    console.log(`Added router address ${SWAP_ROUTER_ADDRESS} to USSD contract`);

    await this.USSD.setRebalancer(this.rebalancer.address);
    console.log(`Added rebalancer address to USSD contract`);

    await this.USSD.approveToRouter(USDT, web3.utils.toBN('1000000000000000000000000000000'));
    console.log(`Approved USDT to be traded by router from USSD contract`);

    await this.USSD.approveToRouter(this.USSD.address, web3.utils.toBN('1000000000000000000000000000000'));
    console.log(`Approved USSD to be traded by router from USSD contract`);


    // perform simulation with random events
    for (var t = 0; t < 100; t++) {

      await time.advanceBlock();
      console.log("------------------------------------------------------------------------------");
      let blockNumber = await web3.eth.getBlockNumber();
      console.log("Block " + blockNumber);

      await USDTContract.methods.balanceOf(USSDaddr).call(function(error, result) {
        console.log(`USSD USDT collateral: ${result}`);
      });
      await WETHContract.methods.balanceOf(USSDaddr).call(function(error, result) {
        console.log(`USSD WETH collateral: ${result}`);
      });
      await WBTCContract.methods.balanceOf(USSDaddr).call(function(error, result) {
        console.log(`USSD BTCB collateral: ${result}`);
      });
      await WBGLContract.methods.balanceOf(USSDaddr).call(function(error, result) {
        console.log(`USSD WBGL collateral: ${result}`);
      });

      await USDTContract.methods.balanceOf(currentPoolAddress).call(function(error, result) {
        console.log(`USDT balance of USSD/USDT POOL at ${currentPoolAddress}: ${result}`);
      });
    
      let ussdbalance3 = (await this.USSD.balanceOf(currentPoolAddress));
      console.log(`USSD balance of USSD/USDT POOL is ${ussdbalance3}`);

      let valuation2 = await this.rebalancer.getOwnValuation({ from: accounts[0] });
      console.log(`USSD rebalancer price valuation is: ${valuation2}`);

      let collateralFactor = await this.USSD.collateralFactor({ from: accounts[0] });
      console.log(`Current USSD collateral factor: ${collateralFactor}`);

      console.log("------------------------------------------------------------------------------");
      const action = Math.floor(Math.random() * 7);

      switch(action) {
        case 0:
            priceUSDT = await this.oracleUSDT.getPriceUSD();
            priceUSDT = priceUSDT.iaddn(Math.random() * 200000 - 100000);
            console.log(`USDT price changed to ${priceUSDT}`);
            await this.oracleUSDT.setPriceUSD(priceUSDT);
            break;
        case 1:
            priceWETH = await this.oracleWETH.getPriceUSD();
            priceWETH = priceWETH.iaddn(Math.random() * 200000 - 50000);
            console.log(`WETH price changed to ${priceWETH}`);
            await this.oracleWETH.setPriceUSD(priceWETH);
            break;
        case 2:
            priceWBTC = await this.oracleWBTC.getPriceUSD();
            priceWBTC = priceWBTC.iaddn(Math.random() * 200000 - 50000);
            console.log(`WBTC price changed to ${priceWBTC}`);
            await this.oracleWBTC.setPriceUSD(priceWBTC);
            break;
        case 3:
            priceWBGL = await this.oracleWBGL.getPriceUSD();
            priceWBGL = priceWBGL.iaddn(Math.random() * 200000 - 50000);
            console.log(`WBGL price changed to ${priceWBGL}`);
            await this.oracleWBGL.setPriceUSD(priceWBGL);
            break;
        case 4:
              // swap USDT for USSD
              console.log("User swaps 100 USDT for USSD");
              argsparam = web3.eth.abi.encodeParameter(
              {
                  "params": {
                      "path": 'bytes',
                      "recipient": 'address',
                      "amountIn": 'uint256',
                      "amountOutMin": 'uint256',
                  }
              },
              {
                  "path": path_USDT_USSD,
                  "recipient": accounts[0],
                  "amountIn": "100000000000000000000",
                  "amountOutMin": 0,
              }
            );

            await web3.eth.sendTransaction({
              to: SWAP_ROUTER_ADDRESS,
              data: "0xb858183f" + argsparam.substring(2),
              from: accounts[0],
              gas: '7000000'
            }, function(error, hash){
              if (error != null) {
                  console.log('Error', error);
              } else {
                  console.log('exactInput swap operation tx hash', hash);
                  txhash = hash;
              }
            });
            break;
        case 5:
              // swap USSD for USDT
              console.log("User swaps 100 USSD for USDT");
              argsparam = web3.eth.abi.encodeParameter(
                {
                    "params": {
                        "path": 'bytes',
                        "recipient": 'address',
                        "amountIn": 'uint256',
                        "amountOutMin": 'uint256',
                    }
                },
                {
                    "path": path_USSD_USDT,
                    "recipient": accounts[0],
                    "amountIn": "100000000",
                    "amountOutMin": 0,
                }
              );
    
              await web3.eth.sendTransaction({
                to: SWAP_ROUTER_ADDRESS,
                data: "0xb858183f" + argsparam.substring(2),
                from: accounts[0],
                gas: '7000000'
              }, function(error, hash){
                if (error != null) {
                    console.log('Error', error);
                } else {
                    console.log('exactInput swap operation tx hash', hash);
                    txhash = hash;
                }
              });
              break;
        case 6:
                console.log("Performing rebalancing");

                //let amountUSDTToSell;

                let valuationRebalancer = await this.rebalancer.getOwnValuation({ from: accounts[0] });
                let valuationBN = web3.utils.toBN(valuationRebalancer);
                if (valuationBN.cmp(web3.utils.toBN('1000000')) > 0) {
                  console.log(`USSD rebalancer price valuation is: ${valuationBN}, > 1, sell USSD, buy collateral`);
                
                  let amountUSSDToSell;

                  if (USSDFirst) {
                    amountUSSDToSell = (await this.rebalancer.calculateAmountTillPriceMatch(web3.utils.toBN('79228162514264337593543950336000000')));
                    console.log(`Amount USSD to Sell is ${amountUSSDToSell}`);
                  } else {
                    amountUSSDToSell = (await this.rebalancer.calculateAmountTillPriceMatch(web3.utils.toBN('79228162514264337593543')));
                    console.log(`Amount USSD to Sell is ${amountUSSDToSell}`);
                  }

                  // this seems to work
                } else {
                  console.log(`USSD rebalancer price valuation is: ${valuationBN}, < 1, sell collateral, buy USSD`);

                  let amountUSDTToSell;

                  if (USSDFirst) {
                    amountUSDTToSell = (await this.rebalancer.calculateAmountTillPriceMatch(web3.utils.toBN('79228162514264337593543950336000000')));
                    console.log(`Amount USDT to Sell is ${amountUSDTToSell}`);
                  } else {
                    amountUSDTToSell = (await this.rebalancer.calculateAmountTillPriceMatch(web3.utils.toBN('79228162514264337593543')));
                    console.log(`Amount USDT to Sell is ${amountUSDTToSell}`);
                  }
                }
  
                await this.rebalancer.rebalance();
                break;
        }
      }
  })
});
