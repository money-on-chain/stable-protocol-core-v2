import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS, mineUpTo } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const mintTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_NON_EXISTENT = 4;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("Feature: mint Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ deployer, alice, bob } = await getNamedAccounts());
    });
    describe("WHEN alice sends 0 Asset to mint TP", function () {
      it("THEN tx reverts because the amount of AC is invalid", async function () {
        await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 0 })).to.be.revertedWithCustomError(
          mocContracts.mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN alice sends 100 Asset to mint 100 TP but there is not collateral in the protocol", function () {
      it("THEN tx reverts because there is not enough TP to mint", async function () {
        await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 100 })).to.be.revertedWithCustomError(
          mocContracts.mocImpl,
          ERRORS.INSUFFICIENT_TP_TO_MINT,
        );
      });
    });
    describe("GIVEN 3000 Asset as collateral in the protocol", function () {
      /*  
        nAC = 3000    
        nTP = 0
        lckAC = 0
        ctarg = 4
        => TP available to mint = 1000
        */
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: deployer, qTC: 3000 });
      });
      describe("AND TP price provider is deprecated", function () {
        beforeEach(async function () {
          await mocContracts.priceProviders[TP_0].deprecatePriceProvider();
        });
        describe("WHEN alice tries to mint 23500 TP", function () {
          it("THEN tx reverts because invalid price provider", async function () {
            await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INVALID_PRICE_PROVIDER,
            );
          });
        });
      });
      describe("WHEN alice tries to mint a non-existent TP", function () {
        it("THEN tx reverts with panice code 0x32 array out of bounded", async function () {
          await expect(mocFunctions.mintTP({ i: TP_NON_EXISTENT, from: alice, qTP: 100 })).to.be.revertedWithPanic(
            "0x32",
          );
        });
      });
      describe("WHEN alice sends 100 Asset to mint 100 TP to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(
            mocFunctions.mintTPto({ i: TP_0, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTP: 100 }),
          ).to.be.revertedWith(ERRORS.MINT_TO_ZERO_ADDRESS);
        });
      });
      describe("WHEN alice tries to mint 1 wei TP", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 1, applyPrecision: false }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
        });
      });
      describe("WHEN alice sends 0.4 Asset to mint 100 TP", function () {
        // TP price: 235 => 100TP = 0.4255 Assets
        it("THEN tx reverts because the amount of AC is insufficient", async function () {
          await expect(
            mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 100, qACmax: 0.4 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice sends 105(exactly amount) Asset to mint 23500 TP", function () {
        let tx: ContractTransaction;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          tx = await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500, qACmax: 105 });
        });
        it("THEN alice receives 23500 TP", async function () {
          assertPrec(23500, await mocFunctions.tpBalanceOf(TP_0, alice));
        });
        it("THEN Moc balance increase 100 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(100 * 1.05, diff);
        });
        it("THEN a TPMinted event is emitted", async function () {
          // tp: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTP: 23500 TP
          // qAC: 100 AC + 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              alice,
              pEth(23500),
              pEth(100 * 1.05),
              pEth(100 * 0.05),
            );
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 23500 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth(23500));
        });
        describe("AND alice tries to mint 131739 TP more", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 100
            ctarg = 5.54
            => TP available to mint = 131738.2238
        */
          it("THEN tx reverts because there is not enough TP to mint", async function () {
            await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 131738.23 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INSUFFICIENT_TP_TO_MINT,
            );
          });
        });
        describe("AND alice sends 2350000(exceeded amount) Asset to mint 23500 TP", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 100
            ctarg = 5.54
            => TP available to mint = 131738.2238
        */
          let alicePrevACBalance: Balance;
          let alicePrevTPBalance: Balance;
          let mocPrevACBalance: Balance;
          let mocFeeFlowPrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            alicePrevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
          });
          it("THEN alice receives 23500 TP", async function () {
            const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
            assertPrec(23500, diff);
          });
          it("THEN Moc balance increase 100 AC", async function () {
            const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            const diff = mocActualACBalance.sub(mocPrevACBalance);
            assertPrec(100, diff);
          });
          it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
            assertPrec(100 * 0.05, diff);
          });
          it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec(100 * 1.05, diff);
          });
        });
      });
      describe("WHEN alice sends 105 Asset to mint 23500 TP to bob", function () {
        /*  
          nAC = 3000    
          nTP = 0
          lckAC = 0
          ctarg = 4
          => TP available to mint = 1000
        */
        let tx: ContractTransaction;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          tx = await mocFunctions.mintTPto({ i: TP_0, from: alice, to: bob, qTP: 23500 });
        });
        it("THEN bob receives 23500 TP", async function () {
          assertPrec(23500, await mocFunctions.tpBalanceOf(TP_0, bob));
        });
        it("THEN Moc balance increase 100 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(100 * 1.05, diff);
        });
        it("THEN a TPMinted event is emitted", async function () {
          // tp: 0
          // sender: alice || mocWrapper
          // receiver: bob
          // qTP: 23500 TP
          // qAC: 100 AC + 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              bob,
              pEth(23500),
              pEth(100 * 1.05),
              pEth(100 * 0.05),
            );
        });
      });
      describe("AND 23500 TP0 are minted", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ i: TP_0, from: deployer, qTP: 23500 });
        });
        describe("AND Pegged Token has been revaluated to 37.9", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 620
            => coverage = 5 
        */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "37.9");
          });
          it("THEN the coverage is 5", async function () {
            assertPrec("4.999574468085106382", await mocContracts.mocImpl.getCglb());
          });
          describe("WHEN Alice tries to mint 1 TP", function () {
            it("THEN tx reverts because coverage is below the target coverage adjusted by the moving average", async function () {
              await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 1 })).to.be.revertedWithCustomError(
                mocContracts.mocImpl,
                ERRORS.LOW_COVERAGE,
              );
            });
          });
        });
        describe("AND Pegged Token has been revaluated to 38, so there are 75 TP0 available to mint", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 618
            ctargemaCA = 5
            ctargemaTP = 5
            => TP available to mint = 75
        */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 38);
          });
          it("THEN there are 75 TP available to mint", async function () {
            assertPrec("75.000000000000000020", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
          });
          describe("WHEN Alice tries to mint 75.1 TP", function () {
            it("THEN tx reverts because there is not enough TP to mint", async function () {
              await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 75.1 })).to.be.revertedWithCustomError(
                mocContracts.mocImpl,
                ERRORS.INSUFFICIENT_TP_TO_MINT,
              );
            });
          });
        });
        describe("AND Pegged Token has been devaluated to 300", function () {
          /*  
            nAC = 3100    
            nTP = 23500 + 3250(tp gain)
            lckAC = 78.33 + 10.835(tp gain)
            nACgain = 2.1666
            ctargemaCA = 7.07
            ctargemaTP = 7.07
            => TP available to mint = 121847.2421
            => coverage = 34.74
            => pTCac = 1.002
          */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 300);
          });
          it("THEN there are 121847.2421 TP available to mint", async function () {
            assertPrec("121847.242150377340925125", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
          });
          it("THEN the coverage is 34.74", async function () {
            assertPrec("34.742056074766355140", await mocContracts.mocImpl.getCglb());
          });
          it("THEN TC price is 1.002", async function () {
            assertPrec("1.002888888888888888", await mocContracts.mocImpl.getPTCac());
          });
          describe("AND EMA is updated", function () {
            /*
            ctargemaCA = 6.93
            ctargemaTP = 6.93
            => TP available to mint = 125449.0669
            */
            beforeEach(async function () {
              await mineUpTo(await mocContracts.mocImpl.nextEmaCalculation());
              await mocContracts.mocImpl.updateEmas();
            });
            it("THEN there are 125449.0669 TP available to mint", async function () {
              assertPrec("125449.066971443529804161", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
            });
          });
          describe("AND 3000 TP 0 are minted", function () {
            /*  
            nAC = 3110    
            nTP = 23500 + 3000
            iou = 21.66
            */
            let tx: ContractTransaction;
            beforeEach(async function () {
              tx = await mocFunctions.mintTP({ i: TP_0, from: deployer, qTP: 3000 });
            });
            it("THEN a TPMinted event is emitted", async function () {
              // tp: 0
              // sender: deployer || mocWrapper
              // receiver: deployer
              // qTP: 3000 TP
              // qAC: 10 AC + 5% for Moc Fee Flow
              // qACfee: 5% AC
              await expect(tx)
                .to.emit(mocContracts.mocImpl, "TPMinted")
                .withArgs(
                  TP_0,
                  mocContracts.mocWrapper?.address || deployer,
                  deployer,
                  pEth(3000),
                  pEth(10 * 1.05),
                  pEth(10 * 0.05),
                );
            });
            describe("AND Pegged Token has been devaluated to 1000", function () {
              /*  
              nAC = 3110    
              nTP = 26500 + 41750(tp gain)
              lckAC = 26.5 + 41.75(tp gain)
              nACgain = 2.1666(iou) + 6.18(PnL)  
              ctargemaCA = 23.58
              ctargemaTP = 23.58
              => TP available to mint = 66087.4
              => coverage = 45.44
              => pTCac = 1.011
              */
              beforeEach(async function () {
                await mocFunctions.pokePrice(TP_0, 1000);
              });
              it("THEN there are 66087.4 TP available to mint", async function () {
                assertPrec("66087.407998395976575724", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
              });
              it("THEN the coverage is 45.44", async function () {
                assertPrec("45.445421245421245421", await mocContracts.mocImpl.getCglb());
              });
              it("THEN TC price is 1.011", async function () {
                assertPrec("1.011133333333333333", await mocContracts.mocImpl.getPTCac());
              });
              describe("AND EMA is updated", function () {
                /*
                ctargemaCA = 19.88
                ctargemaTP = 19.88
                => TP available to mint = 92369.57
                */
                beforeEach(async function () {
                  await mineUpTo(await mocContracts.mocImpl.nextEmaCalculation());
                  await mocContracts.mocImpl.updateEmas();
                });
                it("THEN there are 92369.57 TP available to mint", async function () {
                  assertPrec("92369.578979910128584434", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
                });
              });
            });
            describe("AND Pegged Token has been revaluated to 250", function () {
              /*  
              nAC = 3110    
              nTP = 26500 + 500(tp gain)
              lckAC = 106 + 2(tp gain)
              nACgain = 2.1666(iou) - 1.76(PnL)  
              ctargemaCA = 5.89
              ctargemaTP = 5.89
              => TP available to mint = 126295.71
              => coverage = 28.79
              => pTCac = 1.000533 
              */
              beforeEach(async function () {
                await mocFunctions.pokePrice(TP_0, 250);
              });
              it("THEN there are 126295.71 TP available to mint", async function () {
                assertPrec("126295.710817372538465788", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
              });
              it("THEN the coverage is 28.29", async function () {
                assertPrec("28.792592592592592592", await mocContracts.mocImpl.getCglb());
              });
              it("THEN TC price is 1.000533", async function () {
                assertPrec("1.000533333333333333", await mocContracts.mocImpl.getPTCac());
              });
              describe("AND EMA is updated", function () {
                /*
                ctargemaCA = 5.84
                ctargemaTP = 5.84
                => TP available to mint = 127951.22
                */
                beforeEach(async function () {
                  await mineUpTo(await mocContracts.mocImpl.nextEmaCalculation());
                  await mocContracts.mocImpl.updateEmas();
                });
                it("THEN there are 127951.22 TP available to mint", async function () {
                  assertPrec("127951.224154539014099053", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
                });
              });
            });
          });
        });
        describe("AND Pegged Token has been revaluated to 100", function () {
          /*  
            nAC = 3100    
            nTP = 23500 + 0(tp gain)
            lckAC = 235 + 0(tp gain)
            nACgain = 0
            ctargemaCA = 5
            ctargemaTP = 5
            => TP available to mint = 48125
            => coverage = 13.19
            => pTCac = 0.955
          */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 100);
          });
          it("THEN there are 48125 TP available to mint", async function () {
            assertPrec(48125, await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
          });
          it("THEN the coverage is 13.19", async function () {
            assertPrec("13.191489361702127659", await mocContracts.mocImpl.getCglb());
          });
          it("THEN TC price is 0.955", async function () {
            assertPrec(0.955, await mocContracts.mocImpl.getPTCac());
          });
          describe("AND EMA is updated", function () {
            /*
            ctargemaCA = 5
            ctargemaTP = 5
            => TP available to mint = 48125
            */
            beforeEach(async function () {
              await mineUpTo(await mocContracts.mocImpl.nextEmaCalculation());
              await mocContracts.mocImpl.updateEmas();
            });
            it("THEN there are 48125 TP available to mint", async function () {
              assertPrec(48125, await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
            });
          });
          describe("AND 1000 TP are minted", function () {
            /*  
            nAC = 3110    
            nTP = 23500 + 1000
            iou = -135
            */
            let tx: ContractTransaction;
            beforeEach(async function () {
              tx = await mocFunctions.mintTP({ i: TP_0, from: deployer, qTP: 1000 });
            });
            it("THEN a TPMinted event is emitted", async function () {
              // tp: 0
              // sender: deployer || mocWrapper
              // receiver: deployer
              // qTP: 1000 TP
              // qAC: 10 AC + 5% for Moc Fee Flow
              // qACfee: 5% AC
              await expect(tx)
                .to.emit(mocContracts.mocImpl, "TPMinted")
                .withArgs(
                  TP_0,
                  mocContracts.mocWrapper?.address || deployer,
                  deployer,
                  pEth(1000),
                  pEth(10 * 1.05),
                  pEth(10 * 0.05),
                );
            });
            describe("AND Pegged Token has been devaluated to 1000", function () {
              /*  
              nAC = 3110    
              nTP = 24500 + 4275(tp gain)
              lckAC = 24.5 + 42.75(tp gain)
              nACgain = -13.5(iou) + 22.05(PnL)  
              ctargemaCA = 23.58
              ctargemaTP = 23.58
              => TP available to mint = 67122.83
              => coverage = 46.11
              => pTCac = 1.0114
              */
              beforeEach(async function () {
                await mocFunctions.pokePrice(TP_0, 1000);
              });
              it("THEN there are 67122.83 TP available to mint", async function () {
                assertPrec("67122.836865805061029229", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
              });
              it("THEN the coverage is 46.11", async function () {
                assertPrec("46.118215613382899628", await mocContracts.mocImpl.getCglb());
              });
              it("THEN TC price is 1.0114", async function () {
                assertPrec("1.0114", await mocContracts.mocImpl.getPTCac());
              });
              describe("AND EMA is updated", function () {
                /*
                ctargemaCA = 19.88
                ctargemaTP = 19.88
                => TP available to mint = 93411.93
                */
                beforeEach(async function () {
                  await mineUpTo(await mocContracts.mocImpl.nextEmaCalculation());
                  await mocContracts.mocImpl.updateEmas();
                });
                it("THEN there are 93411.93 TP available to mint", async function () {
                  assertPrec("93411.939256558090641158", await mocContracts.mocImpl.getTPAvailableToMint(TP_0));
                });
              });
            });
          });
        });
        describe("WHEN Alice tries to mint 3914.13 TP1", function () {
          it("THEN tx reverts because there is not enough TP1 to mint", async function () {
            await expect(mocFunctions.mintTP({ i: TP_1, from: alice, qTP: 3914.13 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INSUFFICIENT_TP_TO_MINT,
            );
          });
        });
        describe("WHEN Alice mints 3914.1 TP1", function () {
          let alicePrevTPBalance: Balance;
          beforeEach(async function () {
            alicePrevTPBalance = await mocFunctions.tpBalanceOf(TP_1, alice);
            await mocFunctions.mintTP({ i: TP_1, from: alice, qTP: 3914.1 });
          });
          it("THEN alice receives 3914.1 TP1", async function () {
            const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_1, alice);
            const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
            assertPrec(3914.1, diff);
          });
        });
        describe("WHEN alice mints 525 TP 1", function () {
          /*  
            nAC = 3100    
            nTP0 = 23500
            nTP0 = 0
            lckAC = 100
            ctarg = 5.54
            => TP 1 available to mint = 3914,123797
          */
          let tx: ContractTransaction;
          let alicePrevACBalance: Balance;
          let mocPrevACBalance: Balance;
          let mocFeeFlowPrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            tx = await mocFunctions.mintTP({ i: TP_1, from: alice, qTP: 525, qACmax: 105 });
          });
          it("THEN alice receives 525 TP1", async function () {
            assertPrec(525, await mocFunctions.tpBalanceOf(TP_1, alice));
          });
          it("THEN Moc balance increase 100 AC", async function () {
            const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            const diff = mocActualACBalance.sub(mocPrevACBalance);
            assertPrec(100, diff);
          });
          it("THEN Moc Fee Flow balance increase 0.1% of 100 AC", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
            assertPrec(100 * 0.001, diff);
          });
          it("THEN alice balance decrease 100 Asset + 0.1% for Moc Fee Flow", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec(100 * 1.001, diff);
          });
          it("THEN a TPMinted event is emitted", async function () {
            // tp: 1
            // sender: alice || mocWrapper
            // receiver: alice
            // qTP: 525 TP
            // qAC: 100 AC + 0.1% for Moc Fee Flow
            // qACfee: 0.1% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPMinted")
              .withArgs(
                TP_1,
                mocContracts.mocWrapper?.address || alice,
                alice,
                pEth(525),
                pEth(100 * 1.001),
                pEth(100 * 0.001),
              );
          });
        });
      });
    });
  });
};

export { mintTPBehavior };
