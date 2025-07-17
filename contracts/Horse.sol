// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Horse is ERC721, Ownable {
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint256) public priceList;
    uint256 public totalSupply;
    uint256 public tokenID;
    bool internal locked;

    // create event to get transfer status
    event TransferStatus(bool success, string message);
    event WithdrawalStatus(bool success, string message);

    constructor() ERC721("Horse", "HRS") Ownable(msg.sender) {
        tokenID = 0;
    }

    // Existing state, constructor, etc...
    receive() external payable {} // Accept plain ETH transfers (no function call data)

    fallback() external payable {} // Optional: Accept ETH with data

    function mintNFT(address _to, string memory uri) public onlyOwner {
        _mint(_to, tokenID);
        _tokenURIs[tokenID] = uri;
        tokenID++;
        totalSupply++;
    }

    function setPrice(uint256 _tID, uint256 _price) public {
        priceList[_tID] = _price;
    }

    function getPrice(uint256 _tID) public view returns (uint256) {
        return priceList[_tID];
    }
    
    function setTokenURI(uint256 tokenId, string memory _uri) public {
        require(ownerOf(tokenId) == msg.sender, "Only owner can set token URI");
        _tokenURIs[tokenId] = _uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return _tokenURIs[tokenId];
    }

    function transferNFTByValue(uint256 tokenId) public payable {
        uint256 amount = msg.value;
        uint256 required = priceList[tokenId];
        require(amount >= required, "Transfer amount exceeds price");
        require(msg.sender.balance >= amount, "Insufficient funds");

        address payable _owner = payable(ownerOf(tokenId));
        (bool sent, ) = _owner.call{value: amount}("");
        // require(sent, "ETH Transfer failed");

        safeTransferFrom(_owner, msg.sender, tokenId);
        emit TransferStatus(sent, "Transfer request completed");
    }

    function getMyTokens(address _owner) external view returns (uint256[] memory) {
        uint256 count = balanceOf(_owner);
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < tokenID; i++) {
            if (ownerOf(i) == _owner) {
                result[index++] = i;
            }
        }
        return result;
    }


    function burnNFT(uint256 _tokenID) public {
        require(ownerOf(_tokenID) == msg.sender, "Only owner can burn NFT");
        _burn(_tokenID);
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
