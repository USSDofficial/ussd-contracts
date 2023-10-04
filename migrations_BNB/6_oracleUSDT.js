const StableOracleWETH = artifacts.require("StableOracleWETH");
const StableOracleUSDT = artifacts.require("StableOracleUSDT");

module.exports = async function (deployer) {
  const StableOracleWETH_instance = await StableOracleWETH.deployed();
  console.log("Stable oracle WETH deployed at address " + StableOracleWETH_instance.address);

  const StableOracleUSDT_instance = await deployer.deploy(StableOracleUSDT, StableOracleWETH_instance.address);
  console.log("Stable oracle USDT deployed at address " + StableOracleUSDT_instance.address);
};
