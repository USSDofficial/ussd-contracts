module.exports = {
  networks: {
    mainnet_fork: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: 1,       // Any network (default: none)
    },
    bnb_fork: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: 56,       // Any network (default: none)
    },
    live: {
      network_id: 1,
    },
  },

  mocha: {
    // timeout: 100000
  },

  compilers: {
    solc: {
      version: "0.8.6",
      settings: {
        optimizer: {
          enabled: false,
          runs: 200
        }
      }
    }
  },

  plugins: [
    "truffle-contract-size"
  ]
};
