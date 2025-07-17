const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Horse Contract Full Functionality", function () {
  let horse;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const Horse = await ethers.getContractFactory("Horse");
    horse = await Horse.deploy();
    await horse.waitForDeployment();
  });

  describe("mintNFT", () => {
    it("should allow the owner to mint NFT with URI", async function () {
      const tokenURI = "ipfs://sample-uri-123";

      await expect(horse.connect(owner).mintNFT(addr1.address, tokenURI))
        .to.emit(horse, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 0);

      expect(await horse.ownerOf(0)).to.equal(addr1.address);
      expect(await horse.tokenURI(0)).to.equal(tokenURI);
      expect(await horse.totalSupply()).to.equal(1);
    });

    it("should increment tokenID and totalSupply after each mint", async function () {
      await horse.connect(owner).mintNFT(owner.address, "ipfs://a");
      await horse.connect(owner).mintNFT(addr1.address, "ipfs://b");

      expect(await horse.tokenID()).to.equal(2);
      expect(await horse.totalSupply()).to.equal(2);
    });
  });

  describe("setPrice / getPrice", () => {
    it("should allow setting and getting token price", async () => {
      await horse.connect(owner).mintNFT(owner.address, "ipfs://uri");
      await horse.setPrice(0, ethers.parseEther("1"));
      expect(await horse.getPrice(0)).to.equal(ethers.parseEther("1"));
    });
  });

  describe("setTokenURI", () => {
    it("should allow owner to update token URI", async () => {
      await horse.connect(owner).mintNFT(owner.address, "ipfs://old");
      await horse.setTokenURI(0, "ipfs://new");
      expect(await horse.tokenURI(0)).to.equal("ipfs://new");
    });

    it("should revert if not owner", async () => {
      await horse.connect(owner).mintNFT(addr1.address, "ipfs://old");
      await expect(horse.connect(addr2).setTokenURI(0, "ipfs://new"))
        .to.be.revertedWith("Only owner can set token URI");
    });
  });

  describe("transferNFTByValue", () => {
    it("should transfer ownership if value sent is equal to price", async () => {
      await horse.mintNFT(owner.address, "ipfs://uri");
      await horse.setPrice(0, ethers.parseEther("1"));
      await horse.connect(owner).approve(addr1.address, 0);

      await expect(
        horse.connect(addr1).transferNFTByValue(0, { value: ethers.parseEther("1") })
      ).to.emit(horse, "Transfer");

      expect(await horse.ownerOf(0)).to.equal(addr1.address);
    });

    it("should revert if insufficient value is sent", async () => {
      await horse.mintNFT(owner.address, "ipfs://uri");
      await horse.setPrice(0, ethers.parseEther("1"));
      await horse.connect(owner).approve(addr1.address, 0);

      await expect(
        horse.connect(addr1).transferNFTByValue(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Transfer amount exceeds price");
    });

    it("should revert if msg.sender balance is less than amount", async () => {
      await horse.mintNFT(owner.address, "ipfs://uri");
      await horse.setPrice(0, ethers.parseEther("10"));
      await horse.connect(owner).approve(addr1.address, 0);

      // Create a new low-balance wallet and fund it with only 0.01 ETH
      const lowBalanceWallet = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({
        to: lowBalanceWallet.address,
        value: ethers.parseEther("0.01"),
      });

      await horse.connect(owner).approve(lowBalanceWallet.address, 0);

      await expect(
        horse.connect(lowBalanceWallet).transferNFTByValue(0, { value: ethers.parseEther("10") })
      ).to.be.revertedWith("Insufficient funds");
    });

  });

  describe("getMyTokens", () => {
    it("should return list of tokens owned by user", async () => {
      await horse.mintNFT(owner.address, "ipfs://1");
      await horse.mintNFT(owner.address, "ipfs://2");
      await horse.mintNFT(addr1.address, "ipfs://3");

      const tokens = await horse.getMyTokens(owner.address);
      expect(tokens.map(t => t.toString())).to.include.members(["0", "1"]);
    });
  });

  describe("burnNFT", () => {
    it("should burn the NFT if called by owner", async () => {
      await horse.mintNFT(owner.address, "ipfs://uri");
      await horse.burnNFT(0);
      await expect(horse.ownerOf(0)).to.be.reverted;
    });

    it("should revert if not called by owner", async () => {
      await horse.mintNFT(addr1.address, "ipfs://uri");
      await expect(horse.connect(addr2).burnNFT(0)).to.be.revertedWith("Only owner can burn NFT");
    });
  });

  describe("withdraw", () => {
    it("should allow owner to withdraw ETH", async () => {
      await owner.sendTransaction({ to: horse.target, value: ethers.parseEther("1") });
      const balanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await horse.withdraw();
      const receipt = await tx.wait();

      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.above(balanceBefore - gasUsed);
    });

    it("should revert if no ETH in contract", async () => {
      await expect(horse.withdraw()).to.be.revertedWith("No balance to withdraw");
    });
  });

  describe("getApproved()", () => {
    it("should return approved address after approval", async () => {
      await horse.mintNFT(owner.address, "ipfs://uri");
      await horse.connect(owner).approve(addr1.address, 0);
      expect(await horse.getApproved(0)).to.equal(addr1.address);
    });
  });

  describe("fallback()", () => {
    it("should accept ETH via fallback when unknown function is called", async () => {
      const unknownFunctionSelector = "0x12345678"; // invalid/unmatched function signature

      const tx = await owner.sendTransaction({
        to: horse.target,
        data: unknownFunctionSelector,
        value: ethers.parseEther("0.01"),
      });

      await tx.wait();

      // confirm the contract now holds ETH (was accepted via fallback)
      const contractBalance = await ethers.provider.getBalance(horse.target);
      expect(contractBalance).to.equal(ethers.parseEther("0.01"));
    });
  });

  describe("Access Control", () => {
    it("should revert if non-owner tries to mint", async function () {
      await expect(
        horse.connect(addr1).mintNFT(addr1.address, "ipfs://fake")
      ).to.be.reverted;
    });

    it("should revert if non-owner calls withdraw", async () => {
      await expect(horse.connect(addr1).withdraw()).to.be.reverted;
    });
  });
});
