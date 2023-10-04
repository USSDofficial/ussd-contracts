const StableOracleWETH = artifacts.require("StableOracleWETH");
const StableOracleWBGL = artifacts.require("StableOracleWBGL");

module.exports = async function (deployer) {
  const StableOracleWETH_instance = await StableOracleWETH.deployed();
  console.log("Stable oracle WETH deployed at address " + StableOracleWETH_instance.address);

  const StableOracleWBGL_instance = await deployer.deploy(StableOracleWBGL, StableOracleWETH_instance.address);
  console.log("Stable oracle WBGL deployed at address " + StableOracleWBGL_instance.address);
};
