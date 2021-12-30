// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BabyDolz.sol";

import "hardhat/console.sol";

struct Pool {
    address token;
    uint32 lockTime;
    uint64 amountPerReward;
    uint40 rewardPerBlock;
    uint72 minimumDeposit;
    uint144 depositFee;
}

struct Deposit {
    uint176 amount;
    uint40 rewardBlockStart;
    uint40 lockTimeEnd;
}

contract DolzChef is Ownable {
    using SafeERC20 for IERC20;

    address public immutable babyDolz;
    Pool[] public pools;

    mapping(uint256 => mapping(address => Deposit)) public deposits;
    mapping(uint256 => uint256) public collectedFees;

    event DepositFeeUpdated(uint256 indexed poolId, uint256 newDepositFee);
    event MinimumDepositUpdated(uint256 indexed poolId, uint256 newMinimumDeposit);
    event LockTimeUpdated(uint256 indexed poolId, uint256 newLockTime);
    event PoolCreated(
        address indexed token,
        uint256 amountPerReward,
        uint256 rewardPerBlock,
        uint256 depositFee,
        uint256 minimumDeposit,
        uint256 lockTime
    );
    event Deposited(uint256 indexed poolId, address indexed account, uint256 amount);
    event Withdrew(uint256 indexed poolId, address indexed account, uint256 amount);
    event WithdrewFees(uint256 indexed poolId, uint256 amount);
    event Harvested(uint256 indexed poolId, address indexed account, uint256 amount);

    constructor(address _babyDolz) {
        babyDolz = _babyDolz;
    }

    function setDepositFee(uint256 poolId, uint144 newDepositFee) external onlyOwner {
        pools[poolId].depositFee = newDepositFee;
        emit DepositFeeUpdated(poolId, newDepositFee);
    }

    function setMinimumDeposit(uint256 poolId, uint72 newMinimumDeposit) external onlyOwner {
        pools[poolId].minimumDeposit = newMinimumDeposit;
        emit MinimumDepositUpdated(poolId, newMinimumDeposit);
    }

    function setLockTime(uint256 poolId, uint32 newLockTime) external onlyOwner {
        pools[poolId].lockTime = newLockTime;
        emit LockTimeUpdated(poolId, newLockTime);
    }

    function createPool(
        address token,
        uint64 amountPerReward,
        uint40 rewardPerBlock,
        uint144 depositFee,
        uint72 minimumDeposit,
        uint32 lockTime
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
        emit PoolCreated(
            token,
            amountPerReward,
            rewardPerBlock,
            depositFee,
            minimumDeposit,
            lockTime
        );
    }

    function deposit(uint256 poolId, uint176 depositAmount) external {
        require(
            deposits[poolId][msg.sender].amount + depositAmount >= pools[poolId].minimumDeposit,
            "DolzChef: cannot deposit less that minimum deposit value"
        );

        harvest(poolId);

        uint176 fees = (depositAmount * pools[poolId].depositFee) / 1000;
        collectedFees[poolId] += fees;
        deposits[poolId][msg.sender].amount += depositAmount - fees;
        deposits[poolId][msg.sender].lockTimeEnd = uint40(block.timestamp + pools[poolId].lockTime);

        emit Deposited(poolId, msg.sender, depositAmount);
        IERC20(pools[poolId].token).safeTransferFrom(msg.sender, address(this), depositAmount);
    }

    function withdraw(uint256 poolId, uint176 withdrawAmount) external {
        require(
            block.timestamp >= deposits[poolId][msg.sender].lockTimeEnd,
            "DolzChef: can't withdraw before lock time end"
        );

        harvest(poolId);
        deposits[poolId][msg.sender].amount -= withdrawAmount;

        emit Withdrew(poolId, msg.sender, withdrawAmount);
        IERC20(pools[poolId].token).safeTransfer(msg.sender, withdrawAmount);
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

        collectedFees[poolId] -= amount;

        emit WithdrewFees(poolId, amount);
        IERC20(pools[poolId].token).safeTransfer(receiver, amount);
    }

    function harvest(uint256 poolId) public {
        uint256 reward = pendingReward(poolId, msg.sender);
        deposits[poolId][msg.sender].rewardBlockStart = uint40(block.number);

        emit Harvested(poolId, msg.sender, reward);
        BabyDolz(babyDolz).mint(msg.sender, reward);
    }

    function pendingReward(uint256 poolId, address account) public view returns (uint256) {
        return
            ((deposits[poolId][account].amount * pools[poolId].rewardPerBlock) *
                (block.number - deposits[poolId][account].rewardBlockStart)) /
            pools[poolId].amountPerReward;
    }
}
