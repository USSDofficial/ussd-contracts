const USSD = artifacts.require('USSD');

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
    const USSD_instance = await deployProxy(USSD, ["Autonomous Secure Dollar", "USSD"]);

    console.log("USSD deployed at: " + USSD_instance.address);
};
