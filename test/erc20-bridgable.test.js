const { expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { deployMockContract, provider } = waffle;

const oneWeek = 604800;

async function skipGracePeriod() {
  await provider.send('evm_increaseTime', [oneWeek]);
  await provider.send('evm_mine');
}

describe('ERC20Bridgable', () => {
  let owner, user1, user2; // accounts
  let token; // contracts
  let bridge; // mocks

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const ERC20Bridgable = await ethers.getContractFactory('ERC20Bridgable');
    token = await ERC20Bridgable.deploy('ERC20Bridgable', 'ERCB');
    bridge = await deployMockContract(owner, []);
  });

  describe('Initialisation', () => {
    it('should initialise update at zero address, 0 and false', async () => {
      const res = await token.bridgeUpdate();
      expect(res.newBridge).equals(ethers.constants.AddressZero);
      expect(res.endGracePeriod).equals('0');
    });
  });

  describe('Launch bridge update', () => {
    it('should launch bridge update', async () => {
      const receipt = await token.launchBridgeUpdate(bridge.address);
      const res = await token.bridgeUpdate();

      const block = await provider.getBlock(receipt.blockHash);
      const expectedEndOfGracePeriod = block.timestamp + oneWeek;

      expect(receipt)
        .to.emit(token, 'BridgeUpdateLaunched')
        .withArgs(bridge.address, expectedEndOfGracePeriod);
      expect(res.newBridge).equals(bridge.address);
    });

    it('should not launch bridge update if not owner', async () => {
      await expect(token.connect(user1).launchBridgeUpdate(bridge.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should not launch bridge update if last one not executed', async () => {
      await token.launchBridgeUpdate(bridge.address);
      await expect(token.launchBridgeUpdate(bridge.address)).to.be.revertedWith(
        'ERC20Bridgable: current update has to be executed',
      );
    });

    it('should not launch bridge update if address is not a contract', async () => {
      await expect(token.launchBridgeUpdate(user1.address)).to.be.revertedWith(
        'ERC20Bridgable: address provided is not a contract',
      );
    });

    it('should launch bridge update if last one executed', async () => {
      await token.launchBridgeUpdate(bridge.address);
      skipGracePeriod();
      await token.executeBridgeUpdate();

      await token.launchBridgeUpdate(bridge.address);
    });
  });

  describe('Execute bridge update', () => {
    it('should execute bridge update', async () => {
      await token.launchBridgeUpdate(bridge.address);

      skipGracePeriod();

      const receipt = await token.executeBridgeUpdate();
      const resUpdate = await token.bridgeUpdate();

      expect(receipt).to.emit(token, 'BridgeUpdateExecuted').withArgs(bridge.address);
      expect(await token.bridge()).equals(bridge.address);
      expect(resUpdate[0]).equals(ethers.constants.AddressZero);
    });

    it('should not execute bridge update if not owner', async () => {
      await token.launchBridgeUpdate(bridge.address);
      skipGracePeriod();
      await expect(token.connect(user1).executeBridgeUpdate()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should not execute bridge update before 7 days has passed', async () => {
      await token.launchBridgeUpdate(bridge.address);
      await expect(token.executeBridgeUpdate()).to.be.revertedWith(
        'ERC20Bridgable: grace period has not finished',
      );
    });

    it('should not execute if already executed', async () => {
      await token.launchBridgeUpdate(bridge.address);
      skipGracePeriod();
      await token.executeBridgeUpdate();
      await expect(token.executeBridgeUpdate()).to.be.revertedWith(
        'ERC20Bridgable: update already executed',
      );
    });
  });

  describe('Bridge access', () => {
    beforeEach(async () => {
      // Manually set the bridge address to user1
      await provider.send('hardhat_setStorageAt', [
        token.address,
        // We know bridge address position is at position 6
        '0x6',
        // Convert 20 bytes address string to 32 bytes string
        ethers.utils.defaultAbiCoder.encode(['address'], [user1.address]),
      ]);
    });

    describe('Bridge minting', () => {
      it('should mint if bridge', async () => {
        const amount = 1000;
        await expect(() =>
          token.connect(user1).mintFromBridge(user2.address, amount),
        ).to.changeTokenBalance(token, user2, amount);
      });

      it('should not mint if not bridge', async () => {
        await expect(token.connect(user2).mintFromBridge(user1.address, '1000')).to.be.revertedWith(
          'ERC20Bridgable: access denied',
        );
      });
    });

    describe('Bridge burning', () => {
      it('should burn if bridge', async () => {
        const amount = 1000;
        token.connect(user1).mintFromBridge(user2.address, amount);
        await expect(() =>
          token.connect(user1).burnFromBridge(user2.address, amount),
        ).to.changeTokenBalance(token, user2, -amount);
      });

      it('should not burn if not bridge', async () => {
        const amount = 1000;
        token.connect(user1).mintFromBridge(user2.address, amount);
        await expect(token.burnFromBridge(user2.address, amount)).to.be.revertedWith(
          'ERC20Bridgable: access denied',
        );
      });
    });
  });
});
