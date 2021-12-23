const { expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { BigNumber } = ethers;
const { deployMockContract } = waffle;

async function increaseBlocks(amount) {
  for (let i = 0; i < amount; i += 1) {
    await ethers.provider.send('evm_mine');
  }
}

async function increaseTime(secondes) {
  await ethers.provider.send('evm_increaseTime', [secondes]);
  await ethers.provider.send('evm_mine');
}

async function getBlockNumber() {
  return (await ethers.provider.getBlock()).number;
}

function computeExpectedReward(depositAmount, rewardPerBlock, blocksElapsed, amountPerReward) {
  return depositAmount.mul(rewardPerBlock).mul(blocksElapsed).div(amountPerReward);
}

function computeDepositFee(depositAmount, depositFee) {
  return depositAmount.mul(depositFee).div(1000);
}

describe('DolzChef', () => {
  let owner, user1, user2; // users
  let token, babyDolz, dolzChef; // contracts
  const amountPerReward = BigNumber.from('10000000');
  const rewardPerBlock = BigNumber.from('20000');
  const depositFee = 2;
  const minimumDeposit = 100000000;
  const lockTime = 2629800; // 1 mois
  const depositAmount = BigNumber.from('100000000000000000000'); // 100 tokens
  const effectiveDepositAmount = depositAmount.sub(computeDepositFee(depositAmount, depositFee));

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

    await babyDolz.setMinter(dolzChef.address, true);
  });

  describe('Setters', () => {
    beforeEach(async () => {
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
    });

    it('should set deposit fee', async () => {
      const value = 35;
      await dolzChef.setDepositFee(0, value);
      expect((await dolzChef.pools(0)).depositFee).equals(value);
    });

    it('should not set deposit fee if not owner', async () => {
      await expect(dolzChef.connect(user1).setDepositFee(0, 9878)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should set minimum deposit', async () => {
      const value = 20000000;
      await dolzChef.setMinimumDeposit(0, value);
      expect((await dolzChef.pools(0)).minimumDeposit).equals(value);
    });

    it('should not set minimum deposit if not owner', async () => {
      await expect(dolzChef.connect(user1).setMinimumDeposit(0, 9878)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should set lock time', async () => {
      const value = 9872;
      await dolzChef.setLockTime(0, value);
      expect((await dolzChef.pools(0)).lockTime).equals(value);
    });

    it('should not set lock time if not owner', async () => {
      await expect(dolzChef.connect(user1).setLockTime(0, 9878)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('Create pool', () => {
    it('should create a pool', async () => {
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      const res = await dolzChef.pools(0);
      expect(res.token).equals(token.address);
      expect(res.rewardPerBlock).equals(rewardPerBlock);
    });

    it('should create two pools', async () => {
      const secondToken = await deployMockContract(owner, []);
      const secondAmountPerReward = 25783;
      const secondRewardPerBlock = 98;

      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await dolzChef.createPool(
        secondToken.address,
        secondAmountPerReward,
        secondRewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );

      expect((await dolzChef.pools(0)).token).equals(token.address);
      expect((await dolzChef.pools(1)).token).equals(secondToken.address);
    });

    it('should not create a pool if not owner', async () => {
      await expect(
        dolzChef
          .connect(user1)
          .createPool(
            token.address,
            amountPerReward,
            rewardPerBlock,
            depositFee,
            minimumDeposit,
            lockTime,
          ),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Deposit', () => {
    beforeEach(async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits(depositAmount.toString(), 18));
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await token.connect(user1).approve(dolzChef.address, ethers.constants.MaxUint256);
    });

    it('should deposit tokens minest deposit fee', async () => {
      await dolzChef.connect(user1).deposit(0, depositAmount);
      expect((await dolzChef.deposits(0, user1.address)).amount).equals(effectiveDepositAmount);
    });

    it('should update reward block when deposit', async () => {
      await dolzChef.connect(user1).deposit(0, depositAmount);
      const block = await getBlockNumber();
      expect((await dolzChef.deposits(0, user1.address)).rewardBlockStart).equals(block);
    });

    it('should not deposit if under minimum deposit value', async () => {
      await expect(dolzChef.connect(user1).deposit(0, minimumDeposit - 1)).to.be.revertedWith(
        'DolzChef: cannot deposit less that minimum deposit value',
      );
    });

    it('should not get any reward when first deposit', async () => {
      await dolzChef.connect(user1).deposit(0, depositAmount);
      expect(await babyDolz.balanceOf(user1.address)).equals(0);
    });

    it('should get reward when deposit if not first deposit', async () => {
      await dolzChef.connect(user1).deposit(0, depositAmount);
      const blockStart = await getBlockNumber();
      await increaseBlocks(10);
      await dolzChef.connect(user1).deposit(0, minimumDeposit);
      const blockEnd = await getBlockNumber();

      const expectedReward = computeExpectedReward(
        effectiveDepositAmount,
        rewardPerBlock,
        blockEnd - blockStart,
        amountPerReward,
      );
      expect(await babyDolz.balanceOf(user1.address)).equals(expectedReward);
    });
  });

  describe('Deposit fees', () => {
    beforeEach(async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits(depositAmount.toString(), 18));
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await token.connect(user1).approve(dolzChef.address, ethers.constants.MaxUint256);
    });

    it('should collect fees when deposit', async () => {
      await dolzChef.connect(user1).deposit(0, depositAmount);

      const expectedFees = computeDepositFee(depositAmount, depositFee);
      expect(await dolzChef.collectedFees(0)).equals(expectedFees);
    });

    it('should collect fees with a different value', async () => {
      const newDepositFee = 235;
      await dolzChef.setDepositFee(0, newDepositFee);
      await dolzChef.connect(user1).deposit(0, depositAmount);

      const expectedFees = computeDepositFee(depositAmount, newDepositFee);
      expect(await dolzChef.collectedFees(0)).equals(expectedFees);
    });
  });

  describe('Withdraw', () => {
    let blockStart;
    const withdrawAmount = 10000000;

    beforeEach(async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits('10000', 18));
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await token.connect(user1).approve(dolzChef.address, depositAmount);
      await dolzChef.connect(user1).deposit(0, depositAmount);
      blockStart = await getBlockNumber();
      await increaseBlocks(10);
    });

    it('should withdraw tokens', async () => {
      await increaseTime(lockTime);
      await expect(() => dolzChef.connect(user1).withdraw(0, withdrawAmount)).to.changeTokenBalance(
        token,
        user1,
        withdrawAmount,
      );
      expect((await dolzChef.deposits(0, user1.address)).amount).equals(
        effectiveDepositAmount.sub(withdrawAmount),
      );
    });

    it('should update reward block when withdraw', async () => {
      await increaseTime(lockTime);
      await dolzChef.connect(user1).withdraw(0, withdrawAmount);
      const block = await getBlockNumber();
      expect((await dolzChef.deposits(0, user1.address)).rewardBlockStart).equals(block);
    });

    it('should get reward when withdraw', async () => {
      await increaseTime(lockTime);
      await dolzChef.connect(user1).withdraw(0, withdrawAmount);
      const blockEnd = await getBlockNumber();
      const expectedReward = computeExpectedReward(
        effectiveDepositAmount,
        rewardPerBlock,
        blockEnd - blockStart,
        amountPerReward,
      );
      expect(await babyDolz.balanceOf(user1.address)).equals(expectedReward);
    });

    it('should not withdraw more that deposited', async () => {
      await increaseTime(lockTime);
      await expect(dolzChef.connect(user1).withdraw(0, depositAmount.add(1))).to.be.revertedWith(
        'Arithmetic operation underflowed or overflowed outside of an unchecked block',
      );
    });

    it('should not withdraw before lock time end', async () => {
      await expect(dolzChef.connect(user1).withdraw(0, 100)).to.be.revertedWith(
        "DolzChef: can't withdraw before lock time end",
      );
    });
  });

  describe('Pending reward', () => {
    it('should return pending reward', async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits('10000', 18));
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await token.connect(user1).approve(dolzChef.address, depositAmount);

      await dolzChef.connect(user1).deposit(0, depositAmount);
      const blockStart = await getBlockNumber();
      await increaseBlocks(10);
      const blockEnd = await getBlockNumber();

      const expectedReward = computeExpectedReward(
        effectiveDepositAmount,
        rewardPerBlock,
        blockEnd - blockStart,
        amountPerReward,
      );
      expect(await dolzChef.pendingReward(0, user1.address)).equals(expectedReward);
    });
  });

  describe('Harvest', () => {
    beforeEach(async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits('10000', 18));
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await token.connect(user1).approve(dolzChef.address, depositAmount);
      await dolzChef.connect(user1).deposit(0, depositAmount);
    });

    it('should withdraw reward', async () => {
      const blockStart = await getBlockNumber();
      await increaseBlocks(10);
      await dolzChef.connect(user1).harvest(0);
      const blockEnd = await getBlockNumber();

      const expectedReward = computeExpectedReward(
        effectiveDepositAmount,
        rewardPerBlock,
        blockEnd - blockStart,
        amountPerReward,
      );
      expect(await babyDolz.balanceOf(user1.address)).equals(expectedReward);
    });

    it('should update deposit block after withdraw', async () => {
      await increaseBlocks(10);
      await dolzChef.connect(user1).harvest(0);
      const blockEnd = await getBlockNumber();

      expect((await dolzChef.deposits(0, user1.address)).rewardBlockStart).equals(blockEnd);
    });

    it('should not withdraw reward twice', async () => {
      await increaseBlocks(10);
      await dolzChef.connect(user1).harvest(0);

      const expectedReward = computeExpectedReward(
        effectiveDepositAmount,
        rewardPerBlock,
        1,
        amountPerReward,
      );
      await expect(() => dolzChef.connect(user1).harvest(0)).to.changeTokenBalance(
        babyDolz,
        user1,
        expectedReward,
      );
    });

    it('should work for another user', async () => {
      const newDepositAmount = BigNumber.from('2897325982989832489234');
      const newEffectiveDepositAmount = BigNumber.from('2897325982989832489234').sub(
        computeDepositFee(newDepositAmount, depositFee),
      );
      await token.transfer(user2.address, ethers.utils.parseUnits('10000', 18));
      await token.connect(user2).approve(dolzChef.address, newDepositAmount);
      await dolzChef.connect(user2).deposit(0, newDepositAmount);

      const blockStart = await getBlockNumber();
      await increaseBlocks(10);
      await dolzChef.connect(user2).harvest(0);
      const blockEnd = await getBlockNumber();

      const expectedReward = computeExpectedReward(
        newEffectiveDepositAmount,
        rewardPerBlock,
        blockEnd - blockStart,
        amountPerReward,
      );
      expect(await babyDolz.balanceOf(user2.address)).equals(expectedReward);
    });

    it('should work with other values', async () => {
      const newAmountPerReward = BigNumber.from('987324');
      const newRewardPerBlock = BigNumber.from('726');
      const newDepositAmount = BigNumber.from('8848787239857298');
      const newEffectiveDepositAmount = BigNumber.from('8848787239857298').sub(
        computeDepositFee(newDepositAmount, depositFee),
      );

      await dolzChef.createPool(
        token.address,
        newAmountPerReward,
        newRewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await token.connect(user1).approve(dolzChef.address, newDepositAmount);
      await dolzChef.connect(user1).deposit(1, newDepositAmount);

      const blockStart = await getBlockNumber();
      await increaseBlocks(10);
      await dolzChef.connect(user1).harvest(1);
      const blockEnd = await getBlockNumber();

      const expectedReward = computeExpectedReward(
        newEffectiveDepositAmount,
        newRewardPerBlock,
        blockEnd - blockStart,
        newAmountPerReward,
      );
      expect(await babyDolz.balanceOf(user1.address)).equals(expectedReward);
    });
  });

  describe('Withdraw fees', () => {
    beforeEach(async () => {
      await token.transfer(user1.address, ethers.utils.parseUnits('10000', 18));
      await dolzChef.createPool(
        token.address,
        amountPerReward,
        rewardPerBlock,
        depositFee,
        minimumDeposit,
        lockTime,
      );
      await token.connect(user1).approve(dolzChef.address, depositAmount);
      await dolzChef.connect(user1).deposit(0, depositAmount);
    });

    it('should withdraw fees', async () => {
      const expectedFees = computeDepositFee(depositAmount, depositFee);
      await dolzChef.withdrawFees(0, user2.address, expectedFees);
      expect(await token.balanceOf(user2.address)).equals(expectedFees);
    });

    it('should not withdraw more than fees collected', async () => {
      const expectedFees = computeDepositFee(depositAmount, depositFee);
      await expect(dolzChef.withdrawFees(0, user2.address, expectedFees.add(1))).to.be.revertedWith(
        'DolzChef: cannot withdraw more than collected fees',
      );
    });

    it('should not withdraw fees twice', async () => {
      const expectedFees = computeDepositFee(depositAmount, depositFee);
      await dolzChef.withdrawFees(0, user2.address, expectedFees);
      await expect(dolzChef.withdrawFees(0, user2.address, 1)).to.be.revertedWith(
        'DolzChef: cannot withdraw more than collected fees',
      );
    });

    it('should not withdraw fees if not owner', async () => {
      await expect(dolzChef.connect(user1).withdrawFees(0, user2.address, 1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
});
