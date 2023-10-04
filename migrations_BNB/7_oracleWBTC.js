const StableOracleWBTC = artifacts.require("StableOracleWBTC");

module.exports = function (deployer) {
  const StableOracleWBTC_instance = deployer.deploy(StableOracleWBTC);
  console.log("Stable oracle WBTC deployed at address " + StableOracleWBTC_instance.address);
};
