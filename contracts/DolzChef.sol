// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BabyDolz.sol";

import "hardhat/console.sol";

// Pool settings
struct Pool {
    // Address of the token hosted by the pool
    address token;
    // Minimum time in seconds before the tokens staked can be withdrew
    uint32 lockTime;
    // Amount of tokens that give access to 1 reward every block
    uint64 amountPerReward;
    // Value of 1 reward per block
    uint40 rewardPerBlock;
    // Minimum amount of token to deposit per user
    uint72 minimumDeposit;
    // Percentage of the deposit that is collected by the pool, with one decimal
    // Eg. for 34.3 percents, depositFee will have a value of 343
    uint144 depositFee;
}

// User deposit informations
struct Deposit {
    // Cumulated amount deposited
    uint176 amount;
    // Block number from when to compute next reward
    uint40 rewardBlockStart;
    // Timestamp in seconds when the deposit is available for withdraw
    uint40 lockTimeEnd;
}

/**
 * @notice Staking contract to earn BabyDolz tokens
 */
contract DolzChef is Ownable {
    using SafeERC20 for IERC20;

    // BabyDolz token address
    address public immutable babyDolz;
    // List of all the pools created with their settings
    Pool[] public pools;

    // Associate pool id to user address to deposit informations
    mapping(uint256 => mapping(address => Deposit)) public deposits;
    // Associate pool id to the amount of fees collected
    mapping(uint256 => uint256) public collectedFees;

    event AmountPerRewardUpdated(uint256 indexed poolId, uint256 newAmountPerReward);
    event RewardPerBlockUpdated(uint256 indexed poolId, uint256 newRewardPerBlock);
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

    /**
     * @param _babyDolz Address of the BabyDolz token that users will be rewarded with.
     */
    constructor(address _babyDolz) {
        babyDolz = _babyDolz;
    }

    /**
     * @notice Enable to update the amount of tokens that give access to 1 reward every block for a specific pool.
     * @dev Only accessible to owner.
     * @param poolId Id of the pool to update.
     * @param newAmountPerReward New amount of tokens that give access to 1 reward
     */
    function setAmountPerReward(uint256 poolId, uint64 newAmountPerReward) external onlyOwner {
        pools[poolId].amountPerReward = newAmountPerReward;
        emit AmountPerRewardUpdated(poolId, newAmountPerReward);
    }

    /**
     * @notice Enable to update the amount of BabyDolz received as staking reward every block for a specific pool.
     * @dev Only accessible to owner.
     * @param poolId Id of the pool to update.
     * @param newRewardPerBlock New amount of BabyDolz received as staking reward every block.
     */
    function setRewardPerBlock(uint256 poolId, uint40 newRewardPerBlock) external onlyOwner {
        pools[poolId].rewardPerBlock = newRewardPerBlock;
        emit RewardPerBlockUpdated(poolId, newRewardPerBlock);
    }

    /**
     * @notice Enable to update the deposit fee of a specific pool.
     * @dev Only accessible to owner.
     * @param poolId Id of the pool to update.
     * @param newDepositFee New percentage of the deposit that is collected by the pool, with one decimal.
     * Eg. for 34.3 percents, depositFee will have a value of 343
     */
    function setDepositFee(uint256 poolId, uint144 newDepositFee) external onlyOwner {
        // Checks that that percentage is less or equal to 1000 to not exceed 100.0%
        require(newDepositFee <= 1000, "DolzChef: percentage should be equal or lower than 1000");
        pools[poolId].depositFee = newDepositFee;
        emit DepositFeeUpdated(poolId, newDepositFee);
    }

    /**
     * @notice Enable to update the minimum deposit amount of a specific pool.
     * @dev Only accessible to owner.
     * @param poolId Id of the pool to update.
     * @param newMinimumDeposit New minimum token amount to be deposited in the pool by each user.
     */
    function setMinimumDeposit(uint256 poolId, uint72 newMinimumDeposit) external onlyOwner {
        pools[poolId].minimumDeposit = newMinimumDeposit;
        emit MinimumDepositUpdated(poolId, newMinimumDeposit);
    }

    /**
     * @notice Enable to update the lock time of a specific pool.
     * @dev Only accessible to owner.
     * @param poolId Id of the pool to update.
     * @param newLockTime New amount of seconds that users will have to wait after a deposit to be able to withdraw.
     */
    function setLockTime(uint256 poolId, uint32 newLockTime) external onlyOwner {
        pools[poolId].lockTime = newLockTime;
        emit LockTimeUpdated(poolId, newLockTime);
    }

    /**
     * @notice Enable to create a new pool for a token.
     * @dev Only accessible to owner.
     * @param token Addres of the token that can be staked in the pool.
     * @param amountPerReward Amount of tokens that give access to 1 reward every block.
     * @param rewardPerBlock Value of 1 reward per block.
     * @param depositFee Percentage of the deposit that is collected by the pool, with one decimal.
     * Eg. for 34.3 percents, depositFee will have a value of 343
     * @param minimumDeposit Minimum amount of token to deposit per user.
     * @param lockTime Minimum time in seconds before the tokens staked can be withdrew.
     */
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

    /**
     * @notice Enable users to stake their tokens in the pool.
     * @param poolId Id of pool where to deposit tokens.
     * @param depositAmount Amount of tokens to deposit.
     */
    function deposit(uint256 poolId, uint176 depositAmount) external {
        Pool memory pool = pools[poolId]; // gas savings

        // Check if the user deposits enough tokens
        require(
            deposits[poolId][msg.sender].amount + depositAmount >= pool.minimumDeposit,
            "DolzChef: cannot deposit less that minimum deposit value"
        );

        // Send the reward the user accumulated so far and updates deposit state
        harvest(poolId);

        // Compute the fees to collected and update the deposit state
        uint176 fees = (depositAmount * pool.depositFee) / 1000;
        collectedFees[poolId] += fees;
        deposits[poolId][msg.sender].amount += depositAmount - fees;
        deposits[poolId][msg.sender].lockTimeEnd = uint40(block.timestamp + pool.lockTime);

        emit Deposited(poolId, msg.sender, depositAmount);
        IERC20(pools[poolId].token).safeTransferFrom(msg.sender, address(this), depositAmount);
    }

    /**
     * @notice Enable users to with withdraw their stake.
     * @param poolId Id of pool where to withdraw tokens.
     * @param withdrawAmount Amount of tokens to withdraw.
     */
    function withdraw(uint256 poolId, uint176 withdrawAmount) external {
        // Check if the stake is available to withdraw
        require(
            block.timestamp >= deposits[poolId][msg.sender].lockTimeEnd,
            "DolzChef: can't withdraw before lock time end"
        );

        // Send the reward the user accumulated so far and updates deposit state
        harvest(poolId);
        deposits[poolId][msg.sender].amount -= withdrawAmount;

        emit Withdrew(poolId, msg.sender, withdrawAmount);
        IERC20(pools[poolId].token).safeTransfer(msg.sender, withdrawAmount);
    }

    /**
     * @notice Enable the admin to withdraw the fees collected on a specific pool.
     * @dev Only accessible to owner.
     * @param poolId Id of the pool where to withdraw the fees collected.
     * @param receiver Address that will receive the fees.
     * @param amount Amount of fees to withdraw, in number of tokens.
     */
    function withdrawFees(
        uint256 poolId,
        address receiver,
        uint256 amount
    ) external onlyOwner {
        // Check that the amount required in equal or lower to the amount of fees collected
        require(
            amount <= collectedFees[poolId],
            "DolzChef: cannot withdraw more than collected fees"
        );

        collectedFees[poolId] -= amount;

        emit WithdrewFees(poolId, amount);
        IERC20(pools[poolId].token).safeTransfer(receiver, amount);
    }

    /**
     * @notice Enable the users to withdraw their reward without unstaking their deposit.
     * @param poolId Id of the pool where to withdraw the reward.
     */
    function harvest(uint256 poolId) public {
        // Get the amount of tokens to reward the user with
        uint256 reward = pendingReward(poolId, msg.sender);
        // Update the deposit state
        deposits[poolId][msg.sender].rewardBlockStart = uint40(block.number);

        emit Harvested(poolId, msg.sender, reward);
        BabyDolz(babyDolz).mint(msg.sender, reward);
    }

    /**
     * @notice Computes the reward a user is entitled of.
     * @dev Avaible as an external function for frontend as well as internal for harvest function.
     * @param poolId Id of the pool where to get the reward.
     * @param account Address of the account to get the reward for.
     * @return The amount of BabyDolz token the user is entitled to as a staking reward.
     */
    function pendingReward(uint256 poolId, address account) public view returns (uint256) {
        Deposit memory deposited = deposits[poolId][account]; // gas savings
        // Following computation is an optimised version of this:
        // reward = amountStaked / amountPerReward * rewardPerBlock * numberOfElapsedBlocks
        return
            ((deposited.amount * pools[poolId].rewardPerBlock) *
                (block.number - deposited.rewardBlockStart)) / pools[poolId].amountPerReward;
    }
}
