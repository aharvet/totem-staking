//SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BabyDolz is ERC20, Ownable {
    mapping(address => bool) public minters;
    mapping(address => bool) public senders;
    mapping(address => bool) public receivers;

    event MinterSet(address account, bool authorized);
    event SenderSet(address account, bool authorized);
    event ReceiverSet(address account, bool authorized);

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function setMinter(address account, bool authorized) external onlyOwner {
        minters[account] = authorized;
        emit MinterSet(account, authorized);
    }

    function setSender(address account, bool authorized) external onlyOwner {
        senders[account] = authorized;
        emit SenderSet(account, authorized);
    }

    function setReceiver(address account, bool authorized) external onlyOwner {
        receivers[account] = authorized;
        emit ReceiverSet(account, authorized);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (from == address(0)) {
            require(minters[msg.sender], "BabyDolz: sender is not an authorized minter");
        } else {
            require(senders[from] && receivers[to], "BabyDolz: transfer not authorized");
        }
    }
}
