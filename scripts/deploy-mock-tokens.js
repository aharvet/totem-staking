const hre = require('hardhat');

async function main() {
  for (let i = 0; 0 < 3; i += 1) {
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    const mockERC20 = await MockERC20.deploy(`Mock Token ${i}`, `MT${i}`);
    await mockERC20.deployed();
    console.log(`Mock token ${i} deployed to: `, mockERC20.address);

    await hre.run('verify:verify', {
      address: mockERC20.address,
      constructorArguments: [`Mock Token ${i}`, `MT${i}`],
    });
    console.log(`Mock token ${i} verified`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
