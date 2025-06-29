const { expect } = require("chai");

describe("Horse", () => {
  let contract;
  let owner, addr1, addr2;

  beforeEach("Deployment", async () => {
    const Contract = await ethers.getContractFactory("Horse");
    contract = await Contract.deploy();
    await contract.waitForDeployment();

    [owner, addr1, addr2] = await ethers.getSigners();
  });

  describe("Testing", () => {
    const oneEth = ethers.parseEther("1");

    beforeEach("multi-mint", async () => {
      const max = 5;
      for (let t = 0; t < max; t++) {
        await contract.mintNFT(owner.address);
        await contract.setPrice(t, oneEth);
      }
    });

    it("props", async () => {
      expect(await contract.name()).to.equal("Horse");
    });

    // Test for the mintNFT function
    describe("Minting", () => {
      it("should mint unique token IDs", async () => {
        await contract.mintNFT(owner.address);
        await contract.mintNFT(owner.address);
      
        expect(await contract.ownerOf(0)).to.equal(owner.address);
        expect(await contract.ownerOf(1)).to.equal(owner.address);
      });

      it("should allow owner to burn their NFT", async () => {
        await contract.mintNFT(owner.address);
        expect(await contract.ownerOf(0)).to.equal(owner.address);
      
        await contract.burnNFT(0);
      
        // Cannot check revert reason because it uses a custom error
        await expect(contract.ownerOf(0)).to.be.reverted;
      });
  
      
    });

    describe("Setting Price", () => {
      it("should set price", async () => {
        let oneBN = BigInt(oneEth);
        expect(await contract.getPrice(1)).to.equal(oneBN);
      });
    });

    describe("Transfer", () => {
      it("transfer token balance", async () => {
        let oneBN = BigInt(oneEth);
        let tId = 2;
  
        await contract.connect(owner).approve(addr1.address, tId);
        await contract.connect(addr1).transferNFTByValue(tId, {
          value: oneEth,
        });
  
        expect(await contract.ownerOf(tId)).to.equal(addr1.address);
      });
  
      it("transfer check ether balance", async () => {
        let oneBN = BigInt(oneEth);
        let tId = 2;
  
        await contract.connect(owner).approve(addr1.address, tId);
  
        await expect(
          contract.connect(addr1).transferNFTByValue(tId, { value: oneEth })
        ).to.changeEtherBalances(
          [owner.address, addr1.address],
          [oneEth, -oneEth]
        );
      });
  
      it("should revert if transferNFTByValue value is too low", async () => {
        let tokenId = 0;
        await contract.mintNFT(owner.address);
        await contract.setPrice(tokenId, oneEth);
        await contract.approve(addr1.address, tokenId);
      
        await expect(
          contract.connect(addr1).transferNFTByValue(tokenId, {
            value: ethers.parseEther("0.5"),
          })
        ).to.be.revertedWith("Transfer amount exceeds price");
      });
  
      it("should revert if caller doesn't have enough ETH", async () => {
        const lowBalanceWallet = ethers.Wallet.createRandom().connect(ethers.provider);
      
        // Fund the wallet with a tiny amount (0.01 ETH) and wait for it to be mined
        const tx = await owner.sendTransaction({to: lowBalanceWallet.address,value: ethers.parseEther("0.01")});
        await tx.wait();
      
        // Mint NFT to owner
        await contract.mintNFT(owner.address);
      
        // Set price of token
        const tokenId = 0;
        const price = ethers.parseEther("1"); // Price = 1 ETH
        await contract.setPrice(tokenId, price);
      
        // Approve the new wallet as operator
        await contract.approve(lowBalanceWallet.address, tokenId);
      
        // Try transfer 1 ETH from the wallet that has low balance (0.01 ETH)
        await expect(
          contract.connect(lowBalanceWallet).transferNFTByValue(tokenId, {
            value: price
          })
        ).to.be.revertedWith("Insufficient funds");
  
      });
      
      it("should transfer successfully under normal conditions", async () => {
        const price = ethers.parseEther("1");
    
        await contract.mintNFT(owner.address); // tokenId = 0
        await contract.setPrice(0, price);
        await contract.connect(owner).approve(addr1.address, 0);
    
        await expect(
          contract.connect(addr1).transferNFTByValue(0, { value: price })
        ).to.emit(contract, "Transfer");
      });
    });
  
    describe("Withdraw", () => {
      it("should revert if contract balance is 0", async () => {
        await expect(contract.withdraw()).to.be.revertedWith("No balance to withdraw");
      });
    
      it("should allow owner to withdraw balance", async () => {
        const depositAmount = ethers.parseEther("1");
    
        // Send ETH to contract
        await addr1.sendTransaction({
          to: contract.target,
          value: depositAmount
        });
    
        await expect(contract.withdraw()).to.changeEtherBalances(
          [contract.target, owner.address],
          [depositAmount * -1n, depositAmount]
        );
      });
    
      it("should emit WithdrawalStatus event on successful withdrawal", async () => {
        const depositAmount = ethers.parseEther("1");
      
        await addr1.sendTransaction({
          to: contract.target,
          value: depositAmount
        });
      
        await expect(contract.withdraw())
          .to.emit(contract, "WithdrawalStatus")
          .withArgs(true, "Withdrawal request completed");
      });
  
      // Tests for the extra functions
      it("should trigger fallback function when ETH is sent with unknown data", async () => {
        const fallbackTx = {
          to: contract.target, // Address of deployed contract
          data: "0x12345678",  // Random data — no matching function selector
          value: ethers.parseEther("0.5") // Sending ETH
        };
      
        const before = await ethers.provider.getBalance(contract.target);
      
        await addr1.sendTransaction(fallbackTx);
      
        const after = await ethers.provider.getBalance(contract.target);
      
        expect(after - before).to.equal(ethers.parseEther("0.5"));
      });
    });

    describe("Access Control", () => {
      it("should block non-owners from burning the NFT", async () => {
        // Mint the NFT to non-owner (addr1)
        await contract.mintNFT(addr1.address);
      
        // Attempt to burn from non-owner (addr1) - should revert
        await expect(contract.connect(addr1).burnNFT(0)).to.be.revertedWith("Only owner can burn NFT");
      });

      it("should revert if non-owner calls withdraw", async () => {
        await expect(contract.connect(addr1).withdraw()).to.be.reverted;
      });
    });
    
  });
});
