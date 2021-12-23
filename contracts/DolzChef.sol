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
    uint256 depositFee;
    uint256 minimumDeposit;
    uint256 lockTime;
}

struct Deposit {
    uint256 amount;
    uint256 rewardBlockStart;
    uint256 lockTimeEnd;
}

contract DolzChef is Ownable {
    using SafeERC20 for IERC20;

    address public immutable babyDolz;
    Pool[] public pools;

    mapping(uint256 => mapping(address => Deposit)) public deposits;
    mapping(uint256 => uint256) public collectedFees;

    constructor(address _babyDolz) {
        babyDolz = _babyDolz;
    }

    function setDepositFee(uint256 poolId, uint256 depositFee) external onlyOwner {
        pools[poolId].depositFee = depositFee;
    }

    function setMinimumDeposit(uint256 poolId, uint256 minimumDeposit) external onlyOwner {
        pools[poolId].minimumDeposit = minimumDeposit;
    }

    function setLockTime(uint256 poolId, uint256 lockTime) external onlyOwner {
        pools[poolId].lockTime = lockTime;
    }

    function createPool(
        address token,
        uint256 amountPerReward,
        uint256 rewardPerBlock,
        uint256 depositFee,
        uint256 minimumDeposit,
        uint256 lockTime
    ) external onlyOwner {
        pools.push(
            Pool({
                token: token,
                amountPerReward: amountPerReward,
                rewardPerBlock: rewardPerBlock,
                depositFee: depositFee,
                minimumDeposit: minimumDeposit,
                lockTime: lockTime
            })
        );
    }

    function deposit(uint256 poolId, uint256 amount) external {
        require(
            amount >= pools[poolId].minimumDeposit,
            "DolzChef: cannot deposit less that minimum deposit value"
        );

        harvest(poolId);

        uint256 fees = (amount * pools[poolId].depositFee) / 1000;
        collectedFees[poolId] += fees;
        deposits[poolId][msg.sender].amount += amount - fees;
        deposits[poolId][msg.sender].lockTimeEnd = block.timestamp + pools[poolId].lockTime;

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
