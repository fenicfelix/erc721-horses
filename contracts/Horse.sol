// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Horse is ERC721, Ownable {
    uint256 public MAXIMUM_HORSES = 10;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint256) public priceList;
    uint256 public totalSupply;
    uint256 public tokenID;
    bool internal locked;

    // create event to get transfer status
    event TransferStatus(bool success, string message);
    event WithdrawalStatus(bool success, string message);

    constructor() ERC721("Horse", "HRS") Ownable(msg.sender) payable{
        tokenID = 0;
    }

    // Existing state, constructor, etc...
    receive() external payable {} // Accept plain ETH transfers (no function call data)

    fallback() external payable {} // Optional: Accept ETH with data

    function mintNFT(address _to, string memory uri) public payable onlyOwner {
        require(msg.value >= 0.01 ether, "Insufficient funds to mint NFT");
        require(tokenID + 1 < MAXIMUM_HORSES, "Maximum horses reached");

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

    function transferNFT(uint256 tokenId) payable external {
        require(msg.value >= getPrice(tokenId), "Insufficient funds to transfer NFT");
        address owner = payable (ownerOf(tokenId));

        (bool status, ) = owner.call{value: msg.value}("");
        // require(status, "Transfer failed");

        // Transfer ownership of the NFT
        safeTransferFrom(owner, _msgSender(), tokenId);
        emit TransferStatus(status, "Direct NFT transfer completed");
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
        (bool status, ) = owner.call{value: balance}("");

        // require(withdrawn, "Withdrawal failed");
        emit WithdrawalStatus(status, "Withdrawal request completed");
    }
}

// 0x5B38Da6a701c568545dCfcB03FcB875f56beddC4 -- Address 1 (Owner)
// 0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2 -- Address 1 (Owner)
// 1000000000000000000 -- 0.01 ETH
// ipfs://bafybeie4eqm7zgcp5ffgxvgf6xtgpdozsmexlecjmj2lcjcjw2x2rekune/0.json - full url
// ipfs://bafybeie4eqm7zgcp5ffgxvgf6xtgpdozsmexlecjmj2lcjcjw2x2rekune/1.json - full url
