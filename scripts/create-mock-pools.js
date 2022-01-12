const hre = require('hardhat');

const { verify } = require('./utils');

async function main() {
  for (let i = 0; i < 3; i += 1) {
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const mockERC20 = await MockERC20.deploy(`Mock Token ${i}`, `MT${i}`);
    await mockERC20.deployed();
    console.log(`Mock token ${i} deployed to: `, mockERC20.address);

    // await verify(`Mock Token ${i}`, mockERC20.address, [`Mock Token ${i}`, `MT${i}`]);

    await mockERC20.getTokens();
    console.log(`Mock tokens ${i} minted`);

    const dolzChef = await hre.ethers.getContractAt(
      'DolzChef',
      '0x507214228E8d91faf0C7b799e977828De6D63d5b',
    );
    await dolzChef.createPool(
      mockERC20.address,
      13000 * (i + 1),
      100 * (i + 1),
      i + 1,
      40000,
      604800 * (i + 1),
    );
    console.log(`Pool created for mock token ${i}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
