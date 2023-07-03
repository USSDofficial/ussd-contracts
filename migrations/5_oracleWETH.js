const StableOracleWETH = artifacts.require("StableOracleWETH");

module.exports = function (deployer) {
  const StableOracleWETH_instance = deployer.deploy(StableOracleWETH);
  console.log("Stable oracle WETH deployed at address " + StableOracleWETH_instance.address);
};
