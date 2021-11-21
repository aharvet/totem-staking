const hre = require('hardhat');

async function main() {
  const BabyDolz = await hre.ethers.getContractFactory('BabyDolz');
  const babyDolz = await BabyDolz.deploy('BabyDolz', 'BBZ');

  await babyDolz.deployed();

  console.log('BabyDolz deployed to:', babyDolz.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
