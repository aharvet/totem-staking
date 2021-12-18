const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = ethers;

describe('DolzChef', () => {
  let owner, user1, user2; // users
  let token, babyDolz, dolzChef; // contracts
  const amountPerReward = BigNumber.from('10000000');
  const rewardPerBlock = BigNumber.from('20000');
  const depositAmount = BigNumber.from('100000000000000000000'); // 100 tokens

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const Token = await ethers.getContractFactory('Token');
    const BabyDolz = await ethers.getContractFactory('BabyDolz');
    const DolzChef = await ethers.getContractFactory('DolzChef');
    token = await Token.deploy();
    babyDolz = await BabyDolz.deploy('BabyDolz', 'BBZ');
    dolzChef = await DolzChef.deploy(babyDolz.address);
  });

  describe('Create pool', () => {
    it('should create a pool', async () => {
      await dolzChef.createPool(token.address, amountPerReward, rewardPerBlock);
      const res = await dolzChef.pools(0);
      expect(res.token).equals(token.address);
      expect(res.rewardPerBlock).equals(rewardPerBlock);
    });

    it('should not create a pool if not owner', async () => {
      await expect(
        dolzChef.connect(user1).createPool(token.address, amountPerReward, rewardPerBlock),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Deposit', () => {
    beforeEach(async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits(depositAmount.toString(), 18));
      await dolzChef.createPool(token.address, amountPerReward, rewardPerBlock);
    });

    it('should deposit tokens', async () => {
      await token.connect(user1).approve(dolzChef.address, depositAmount);
      await dolzChef.connect(user1).deposit(0, depositAmount);

      const block = (await ethers.provider.getBlock()).number;
      const res = await dolzChef.deposits(0, user1.address);
      expect(res.amount).equals(depositAmount);
      expect(res.rewardBlockStart).equals(block);
    });
  });

  describe('Withdraw reward', () => {
    beforeEach(async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits('10000', 18));
      await dolzChef.createPool(token.address, amountPerReward, rewardPerBlock);
      await token.connect(user1).approve(dolzChef.address, depositAmount);
      await babyDolz.setMinter(dolzChef.address, true);
      await dolzChef.connect(user1).deposit(0, depositAmount);
    });

    it('should withdraw reward', async () => {
      const blockStart = await getBlockNumber();
      await advanceBlocks(10);
      await dolzChef.connect(user1).withdrawReward(0);
      const blockEnd = await getBlockNumber();

      const expectedReward = depositAmount
        .mul(rewardPerBlock)
        .mul(blockEnd - blockStart)
        .div(amountPerReward);
      expect(await babyDolz.balanceOf(user1.address)).equals(expectedReward);
    });

    it('should update deposit block after withdraw', async () => {
      await advanceBlocks(10);
      await dolzChef.connect(user1).withdrawReward(0);
      const blockEnd = await getBlockNumber();

      expect((await dolzChef.deposits(0, user1.address)).rewardBlockStart).equals(blockEnd);
    });

    it('should withdraw reward twice', async () => {
      await advanceBlocks(10);
      await dolzChef.connect(user1).withdrawReward(0);

      // Multiplication by blocks elapsed removed because only advance from 1 block
      const expectedReward = depositAmount.mul(rewardPerBlock).div(amountPerReward);
      await expect(() => dolzChef.connect(user1).withdrawReward(0)).to.changeTokenBalance(
        babyDolz,
        user1,
        expectedReward,
      );
    });
  });
});

async function advanceBlocks(amount) {
  for (let i = 0; i < amount; i += 1) {
    await ethers.provider.send('evm_mine');
  }
}

async function getBlockNumber() {
  return (await ethers.provider.getBlock()).number;
}
