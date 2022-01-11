const hre = require('hardhat');

async function main() {
  const BabyDolz = await hre.ethers.getContractFactory('BabyDolz');
  const babyDolz = await BabyDolz.deploy('BabyDolz', 'BBZ');
  await babyDolz.deployed();
  console.log('BabyDolz deployed to:', babyDolz.address);

  const DolzChef = await hre.ethers.getContractFactory('DolzChef');
  const dolzChef = await DolzChef.deploy(babyDolz.address);
  await dolzChef.deployed();
  console.log('DolzChef deployed to:', dolzChef.address);

  await verify('BabyDolz', babyDolz.address, ['BabyDolz', 'BBZ']);
  await verify('DolzChef', dolzChef.address, [babyDolz.address]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

async function verify(name, address, args) {
  await hre.run('verify:verify', {
    address,
    constructorArguments: args,
  });
  console.log(`${name} verified`);
}
