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

  describe("mintToken", () => {
    it("should revert if sent value is less than 0.01 ETH", async function () {
      await expect(
        horse.connect(owner).mintToken(addr1.address, "ipfs://too-cheap", {
          value: ethers.parseEther("0.005"),
        })
      ).to.be.revertedWith("Insufficient funds to mint NFT");
    });

    it("should revert if maximum horses limit is reached", async function () {
      // Mint up to the limit
      for (let i = 1; i < 10; i++) {
        await horse.connect(owner).mintToken(owner.address, `ipfs://${i}`, {
          value: ethers.parseEther("0.01"),
        });
      }

      // Now try to mint one more — this should revert
      await expect(
        horse.connect(owner).mintToken(owner.address, "ipfs://overflow", {
          value: ethers.parseEther("0.01"),
        })
      ).to.be.revertedWith("Maximum horses reached");
    });

    it("should allow the owner to mint NFT with URI", async function () {
      const tokenURI = "ipfs://sample-uri-123";

      await expect(horse.connect(owner).mintToken(addr1.address, tokenURI, { value: ethers.parseEther("0.01") }))
        .to.emit(horse, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 0);

      expect(await horse.ownerOf(0)).to.equal(addr1.address);
      expect(await horse.tokenURI(0)).to.equal(tokenURI);
      expect(await horse.horses()).to.equal(1);
    });

    it("should revert if non-owner tries to mint", async function () {
      await expect(
        horse.connect(addr1).mintToken(addr1.address, "ipfs://fake", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(horse, "OwnableUnauthorizedAccount");
    });

    it("should increment nextHorseID and horses after each mint", async function () {
      await horse.connect(owner).mintToken(owner.address, "ipfs://a", { value: ethers.parseEther("0.01") });
      await horse.connect(owner).mintToken(addr1.address, "ipfs://b", { value: ethers.parseEther("0.01") });

      expect(await horse.nextHorseID()).to.equal(2);
      expect(await horse.horses()).to.equal(2);
    });
  });

  describe("setPrice / getPrice", () => {
    it("should allow setting and getting token price", async () => {
      await horse.connect(owner).mintToken(owner.address, "ipfs://uri", { value: ethers.parseEther("0.01") });
      await horse.setPrice(0, ethers.parseEther("1"));
      expect(await horse.getPrice(0)).to.equal(ethers.parseEther("1"));
    });
  });

  describe("setHorseURI", () => {
    it("should allow owner to update token URI", async () => {
      await horse.connect(owner).mintToken(owner.address, "ipfs://old", { value: ethers.parseEther("0.01") });
      await horse.setHorseURI(0, "ipfs://new");
      expect(await horse.tokenURI(0)).to.equal("ipfs://new");
    });

    it("should revert if not owner", async () => {
      await horse.connect(owner).mintToken(addr1.address, "ipfs://old", { value: ethers.parseEther("0.01") });
      await expect(horse.connect(addr2).setHorseURI(0, "ipfs://new"))
        .to.be.revertedWith("Only owner can set token URI");
    });
  });

  describe("approve", () => {
    it("should allow owner to approve another address", async () => {
      await horse.connect(owner).mintToken(owner.address, "ipfs://uri", {
        value: ethers.parseEther("0.01"),
      });

      await expect(horse.connect(owner).approve(addr1.address, 0))
        .to.emit(horse, "Approval")
        .withArgs(owner.address, addr1.address, 0);

      expect(await horse.getApproved(0)).to.equal(addr1.address);
    });

    it("should revert if non-owner tries to approve", async () => {
      await horse.connect(owner).mintToken(owner.address, "ipfs://uri", {
        value: ethers.parseEther("0.01"),
      });

      await expect(
        horse.connect(addr1).approve(addr2.address, 0)
      ).to.be.revertedWith("Only owner can approve");
    });

    it("should revert if trying to approve zero address", async () => {
      await horse.connect(owner).mintToken(owner.address, "ipfs://uri", {
        value: ethers.parseEther("0.01"),
      });

      await expect(
        horse.connect(owner).approve(ethers.ZeroAddress, 0)
      ).to.be.revertedWith("Cannot approve zero address");
    });
  });


  describe("transferHorse", () => {
    it("should transfer NFT and emit event if enough ETH sent", async () => {
      // addr1 owns the token
      await horse.connect(owner).mintToken(addr1.address, "ipfs://uri", {
        value: ethers.parseEther("0.01"),
      });

      // Set price
      await horse.connect(addr1).setPrice(0, ethers.parseEther("1"));

      // Approve addr2 to transfer token 0
      await horse.connect(addr1).approve(addr2.address, 0);

      // addr2 pays and transfers the NFT
      await expect(
        horse.connect(addr2).transferHorse(0, { value: ethers.parseEther("1") })
      )
        .to.emit(horse, "TransferStatus")
        .withArgs(true, "Direct NFT transfer completed");

      // Assert ownership
      expect(await horse.ownerOf(0)).to.equal(addr2.address);
    });


    it("should revert if insufficient ETH is sent", async () => {
      await horse.connect(owner).mintToken(addr1.address, "ipfs://uri", {
        value: ethers.parseEther("0.01"),
      });

      await horse.connect(addr1).setPrice(0, ethers.parseEther("1"));

      await expect(
        horse.connect(addr2).transferHorse(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient funds to transfer NFT");
    });


  });


  describe("getMyTokens", () => {
    it("should return list of tokens owned by user", async () => {
      await horse.mintToken(owner.address, "ipfs://0", { value: ethers.parseEther("0.01") });
      await horse.mintToken(owner.address, "ipfs://1", { value: ethers.parseEther("0.01") });
      await horse.mintToken(addr1.address, "ipfs://2", { value: ethers.parseEther("0.01") });

      const tokens = await horse.getMyTokens(owner.address);
      expect(tokens.map(t => t.toString())).to.include.members(["0", "1"]);
    });
  });

  describe("burnToken", () => {
    it("should burn the NFT if called by owner", async () => {
      await horse.mintToken(owner.address, "ipfs://uri", { value: ethers.parseEther("0.01") });
      await horse.burnToken(0);
      await expect(horse.ownerOf(0)).to.be.reverted;
    });

    it("should revert if not called by owner", async () => {
      await horse.mintToken(addr1.address, "ipfs://uri", { value: ethers.parseEther("0.01") });
      await expect(horse.connect(addr2).burnToken(0)).to.be.revertedWith("Only owner can burn NFT");
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

  describe("getApproved", () => {
    it("should return approved address after approval", async () => {
      await horse.mintToken(owner.address, "ipfs://uri", { value: ethers.parseEther("0.01") });
      await horse.connect(owner).approve(addr1.address, 0);
      expect(await horse.getApproved(0)).to.equal(addr1.address);
    });
  });

  describe("fallback", () => {
    it("should accept ETH via fallback when unknown function is called", async () => {
      const unknownFunctionSelector = "0x12345678"; // invalid/unmatched function signature

      const tx = await owner.sendTransaction({
        to: horse.target,
        data: unknownFunctionSelector,
        value: ethers.parseEther("0.01")
      });

      await tx.wait();

      const contractBalance = await ethers.provider.getBalance(horse.target);
      expect(contractBalance).to.equal(ethers.parseEther("0.01"));
    });
  });

  describe("Access Control", () => {
    it("should revert if non-owner calls withdraw", async () => {
      await expect(horse.connect(addr1).withdraw()).to.be.reverted;
    });
  });
});
