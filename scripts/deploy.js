const hre = require('hardhat');

async function main() {
  const BabyDolz = await hre.ethers.getContractFactory('BabyDolz');
  const babyDolz = await BabyDolz.deploy('BabyDolz', 'BBZ');
  await babyDolz.deployed();

  const DolzChef = await hre.ethers.getContractFactory('DolzChef');
  const dolzChef = await DolzChef.deploy(babyDolz.address);
  await dolzChef.deployed();

  console.log('BabyDolz deployed to:', babyDolz.address);
  console.log('DolzChef deployed to:', dolzChef.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
