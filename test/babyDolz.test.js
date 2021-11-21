const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('BabyDolz', function () {
  let owner, user1, user2;
  let babyDolz;

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const BabyDolz = await ethers.getContractFactory('BabyDolz');
    babyDolz = await BabyDolz.deploy('BabyDolz', 'BBZ');
  });

  describe('Minter authorization', () => {
    it('should get minter authorization', async () => {
      expect(await babyDolz.minters(user1.address)).to.be.false;
    });

    it('should set minter', async () => {
      await babyDolz.setMinter(user1.address, true);
      expect(await babyDolz.minters(user1.address)).to.be.true;
      await babyDolz.setMinter(user1.address, false);
      expect(await babyDolz.minters(user1.address)).to.be.false;
    });

    it('should emit an event when set minter', async () => {
      expect(await babyDolz.setMinter(user1.address, true))
        .to.emit(babyDolz, 'MinterSet')
        .withArgs(user1.address, true);
    });

    it('should not set minter if not owner', async () => {
      await expect(babyDolz.connect(user1).setMinter(user1.address, true)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('Mint', () => {
    it('should mint', async function () {
      const amount = 10;
      await babyDolz.setMinter(owner.address, true);
      await babyDolz.mint(user1.address, amount);
      expect(await babyDolz.balanceOf(user1.address)).equal(amount);
    });

    it('should not mint if not minter', async function () {
      await expect(babyDolz.connect(user2).mint(user1.address, 1)).to.be.revertedWith(
        'BabyDolz: sender is not an authorized minter',
      );
    });
  });

  describe('Transfer authorization', () => {
    describe('Sender', () => {
      it('should get sender authorization', async () => {
        expect(await babyDolz.senders(user1.address)).to.be.false;
      });

      it('should set sender', async () => {
        await babyDolz.setSender(user1.address, true);
        expect(await babyDolz.senders(user1.address)).to.be.true;
        await babyDolz.setSender(user1.address, false);
        expect(await babyDolz.senders(user1.address)).to.be.false;
      });

      it('should emit an event when set sender', async () => {
        expect(await babyDolz.setSender(user1.address, true))
          .to.emit(babyDolz, 'SenderSet')
          .withArgs(user1.address, true);
      });

      it('should not set sender if not owner', async () => {
        await expect(babyDolz.connect(user1).setSender(user1.address, true)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        );
      });
    });

    describe('Receiver', () => {
      it('should get receiver authorization', async () => {
        expect(await babyDolz.receivers(user1.address)).to.be.false;
      });

      it('should set receiver', async () => {
        await babyDolz.setReceiver(user1.address, true);
        expect(await babyDolz.receivers(user1.address)).to.be.true;
        await babyDolz.setReceiver(user1.address, false);
        expect(await babyDolz.receivers(user1.address)).to.be.false;
      });

      it('should emit an event when set receiver', async () => {
        expect(await babyDolz.setReceiver(user1.address, true))
          .to.emit(babyDolz, 'ReceiverSet')
          .withArgs(user1.address, true);
      });

      it('should not set sender if not owner', async () => {
        await expect(babyDolz.connect(user1).setReceiver(user1.address, true)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        );
      });
    });
  });

  describe('Transfer', () => {
    beforeEach(async () => {
      await babyDolz.setMinter(owner.address, true);
      await babyDolz.mint(user1.address, ethers.utils.parseUnits('10', 18));
    });

    it('should transfer', async () => {
      const amount = 100000;
      await babyDolz.setSender(user1.address, true);
      await babyDolz.setReceiver(user2.address, true);
      await babyDolz.connect(user1).transfer(user2.address, amount);
      expect(await babyDolz.balanceOf(user2.address)).equal(amount);
    });

    it('should not transfer if sender not authorized', async () => {
      await babyDolz.setReceiver(user2.address, true);
      await expect(babyDolz.connect(user1).transfer(user2.address, 100)).to.be.revertedWith(
        'BabyDolz: transfer not authorized',
      );
    });

    it('should not transfer if receiver not authorized', async () => {
      await babyDolz.setSender(user1.address, true);
      await expect(babyDolz.connect(user1).transfer(user2.address, 100)).to.be.revertedWith(
        'BabyDolz: transfer not authorized',
      );
    });

    it('should not transfer if neither sender nor receiver are authorized', async () => {
      await expect(babyDolz.connect(user1).transfer(user2.address, 100)).to.be.revertedWith(
        'BabyDolz: transfer not authorized',
      );
    });
  });
});
