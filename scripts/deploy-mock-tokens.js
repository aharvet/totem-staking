const hre = require('hardhat');

const { verify } = require('./utils');

async function main() {
  for (let i = 0; 0 < 3; i += 1) {
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const mockERC20 = await MockERC20.deploy(`Mock Token ${i}`, `MT${i}`);
    await mockERC20.deployed();
    console.log(`Mock token ${i} deployed to: `, mockERC20.address);

    await verify(`Mock Token ${i}`, mockERC20.address, [`Mock Token ${i}`, `MT${i}`]);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
