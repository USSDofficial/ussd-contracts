const StableOracleWETH = artifacts.require("StableOracleWETH");
const StableOracleDAI = artifacts.require("StableOracleDAI");

module.exports = async function (deployer) {
  const StableOracleWETH_instance = await StableOracleWETH.deployed();
  console.log("Stable oracle WETH deployed at address " + StableOracleWETH_instance.address);

  const StableOracleDAI_instance = await deployer.deploy(StableOracleDAI, StableOracleWETH_instance.address);
  console.log("Stable oracle DAI deployed at address " + StableOracleDAI_instance.address);
};
