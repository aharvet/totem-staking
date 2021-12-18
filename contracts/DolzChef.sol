// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
}

contract DolzChef is Ownable {
    address public immutable babyDolz;
    Pool[] public pools;

    mapping(uint256 => mapping(address => Deposit)) public deposits;

    constructor(address _babyDolz) {
        babyDolz = _babyDolz;
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
        deposits[poolId][msg.sender].amount += amount;
        IERC20(pools[poolId].token).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 poolId, uint256 amount) external {
        harvest(poolId);
        deposits[poolId][msg.sender].amount -= amount;
        IERC20(pools[poolId].token).transfer(msg.sender, amount);
    }

    function harvest(uint256 poolId) public {
        uint256 reward = ((deposits[poolId][msg.sender].amount * pools[poolId].rewardPerBlock) *
            (block.number - deposits[poolId][msg.sender].rewardBlockStart)) /
            pools[poolId].amountPerReward;
        deposits[poolId][msg.sender].rewardBlockStart = block.number;
        BabyDolz(babyDolz).mint(msg.sender, reward);
    }
}
