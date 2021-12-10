//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IERC20Bridgable.sol";

struct BridgeUpdate {
    address newBridge;
    uint256 endGracePeriod;
}

contract ERC20Bridgable is ERC20, Ownable, IERC20Bridgable {
    using Address for address;

    address public bridge;
    BridgeUpdate public bridgeUpdate;

    modifier onlyBridge() {
        require(msg.sender == bridge, "ERC20Bridgable: access denied");
        _;
    }

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function launchBridgeUpdate(address newBridge) external onlyOwner {
        require(bridgeUpdate.newBridge == address(0), "ERC20Bridgable: current update has to be executed");
        require(newBridge.isContract(), "ERC20Bridgable: address provided is not a contract");

        uint256 endGracePeriod = block.timestamp + 1 weeks;

        bridgeUpdate = BridgeUpdate(newBridge, endGracePeriod);

        emit BridgeUpdateLaunched(newBridge, endGracePeriod);
    }

    function executeBridgeUpdate() external onlyOwner {
        require(
            bridgeUpdate.endGracePeriod <= block.timestamp,
            "ERC20Bridgable: grace period has not finished"
        );
        require(bridgeUpdate.newBridge != address(0), "ERC20Bridgable: update already executed");

        bridge = bridgeUpdate.newBridge;
        emit BridgeUpdateExecuted(bridgeUpdate.newBridge);

        delete bridgeUpdate;
    }

    function mintFromBridge(address account, uint256 amount) external override onlyBridge {
        _mint(account, amount);
    }

    function burnFromBridge(address account, uint256 amount) external override onlyBridge {
        _burn(account, amount);
    }
}
