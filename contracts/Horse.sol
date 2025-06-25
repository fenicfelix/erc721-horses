// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Horse is ERC721, Ownable {
    uint256 public tokenID;
    mapping(uint256 => uint256) public priceList;
    bool internal locked;

    // create event to get transfer status
    event TransferStatus(bool success, string message);
    event WithdrawalStatus(bool success, string message);

    constructor() ERC721("Horse", "HORSE") Ownable(msg.sender) {
        tokenID = 0;
    }

    // Existing state, constructor, etc...
    receive() external payable {} // Accept plain ETH transfers (no function call data)

    fallback() external payable {} // Optional: Accept ETH with data

    function mintNFT(address _to) public {
        _mint(_to, tokenID++);
    }

    function setPrice(uint256 _tID, uint256 _price) public {
        priceList[_tID] = _price;
    }

    function getPrice(uint256 _tID) public view returns (uint256) {
        return priceList[_tID];
    }

    function transferNFTByValue(uint256 tokenId) public payable {
        uint256 amount = msg.value;
        uint256 required = priceList[tokenId];
        require(amount >= required, "Transfer amount exceeds price");
        require(msg.sender.balance >= amount, "Insufficient funds");

        address payable _owner = payable(ownerOf(tokenId));
        (bool sent, ) = _owner.call{value: amount}("");
        // require(sent, "Transfer failed");

        safeTransferFrom(_owner, msg.sender, tokenId);

        emit TransferStatus(sent, "Transfer request completed");
    }

    function burnNFT(uint256 _tID) public {
        require(ownerOf(_tID) == msg.sender, "Only owner can burn NFT");
        _burn(_tID);
    }

    function withdraw() external payable onlyOwner {
        address owner = payable(_msgSender());
        uint256 balance = address(this).balance;

        // Ensure the contract has a balance to withdraw
        require(balance > 0, "No balance to withdraw");
        (bool withdrawn, ) = owner.call{value: balance}("");

        // require(withdrawn, "Withdrawal failed");
        emit WithdrawalStatus(withdrawn, "Withdrawal request completed");
    }
}
