require('dotenv').config();

require('@nomiclabs/hardhat-waffle');
require('hardhat-gas-reporter');
require('@nomiclabs/hardhat-etherscan');
require('solidity-coverage');

// Macros
const optimize = false;
const showGasReporter = false;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: optimize || showGasReporter || false,
        runs: 999999,
      },
    },
  },
  networks: {
    hardhat: {
      // initialBaseFeePerGas: 0,
    },
    // ropsten = {
    //   url: process.env.ROPSTEN_ENDPOINT,
    //   accounts: process.env.DEPLOYER_PRIVATE_KEY,
    // }
  },
  gasReporter: {
    enabled: showGasReporter,
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
