const UniV3LiqCalculator = artifacts.require("UniV3LiqCalculator");

module.exports = function (deployer) {
  deployer.deploy(UniV3LiqCalculator);
};
