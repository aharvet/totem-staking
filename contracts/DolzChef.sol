// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BabyDolz.sol";

import "hardhat/console.sol";

struct Pool {
    address token;
    uint256 amountPerReward;
    uint256 rewardPerBlock;
}

struct Deposit {
    uint256 amount;
    uint256 rewardBlockStart;
    uint256 lockTimeEnd;
}

// withdraw deposit fees

contract DolzChef is Ownable {
    using SafeERC20 for IERC20;

    address public immutable babyDolz;
    uint256 public depositFee;
    uint256 public minimumDeposit;
    uint256 public lockTime;
    Pool[] public pools;

    mapping(uint256 => mapping(address => Deposit)) public deposits;
    mapping(uint256 => uint256) public collectedFees;

    constructor(
        address _babyDolz,
        uint256 _depositFee,
        uint256 _minimumDeposit,
        uint256 _lockTime
    ) {
        babyDolz = _babyDolz;
        depositFee = _depositFee;
        minimumDeposit = _minimumDeposit;
        lockTime = _lockTime;
    }

    function setDepositFee(uint256 _depositFee) external onlyOwner {
        depositFee = _depositFee;
    }

    function setMinimumDeposit(uint256 _minimumDeposit) external onlyOwner {
        minimumDeposit = _minimumDeposit;
    }

    function setLockTime(uint256 _lockTime) external onlyOwner {
        lockTime = _lockTime;
    }

    function createPool(
        address token,
        uint256 amountPerReward,
        uint256 rewardPerBlock
    ) external onlyOwner {
        pools.push(Pool(token, amountPerReward, rewardPerBlock));
    }

    function deposit(uint256 poolId, uint256 amount) external {
        harvest(poolId);
        uint256 depositFees = (amount * depositFee) / 1000;
        collectedFees[poolId] += depositFees;
        deposits[poolId][msg.sender].amount += amount - depositFees;
        deposits[poolId][msg.sender].lockTimeEnd = block.timestamp + lockTime;
        IERC20(pools[poolId].token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 poolId, uint256 amount) external {
        require(
            block.timestamp >= deposits[poolId][msg.sender].lockTimeEnd,
            "DolzChef: can't withdraw before lock time end"
        );
        harvest(poolId);
        deposits[poolId][msg.sender].amount -= amount;
        IERC20(pools[poolId].token).safeTransfer(msg.sender, amount);
    }

    function withdrawFees(
        uint256 poolId,
        address receiver,
        uint256 amount
    ) external onlyOwner {
        require(
            amount <= collectedFees[poolId],
            "DolzChef: cannot withdraw more than collected fees"
        );
        IERC20(pools[poolId].token).safeTransfer(receiver, amount);
    }

    function harvest(uint256 poolId) public {
        uint256 reward = pendingReward(poolId, msg.sender);
        deposits[poolId][msg.sender].rewardBlockStart = block.number;
        BabyDolz(babyDolz).mint(msg.sender, reward);
    }

    function pendingReward(uint256 poolId, address account) public view returns (uint256) {
        return
            ((deposits[poolId][account].amount * pools[poolId].rewardPerBlock) *
                (block.number - deposits[poolId][account].rewardBlockStart)) /
            pools[poolId].amountPerReward;
    }
}
