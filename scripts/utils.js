export async function verify(name, address, args) {
  await hre.run('verify:verify', {
    address,
    constructorArguments: args,
  });
  console.log(`${name} verified`);
}
