pragma solidity ^0.8.17;

import "../collateral/collateralBag/MocCAWrapper.sol";
import "../collateral/rc20/MocCARC20.sol";
import "../tokens/MocTC.sol";
import "../tokens/MocRC20.sol";
import "../mocks/upgradeability/GovernorMock.sol";
import "../mocks/ERC20Mock.sol";
import "../mocks/PriceProviderMock.sol";
import "../interfaces/IPriceProvider.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "hardhat/console.sol";

contract EchidnaMocCoreTester {
    uint256 internal constant PRECISION = 10 ** 18;
    uint256 internal constant UINT256_MAX = ~uint256(0);

    uint256 internal constant MAX_PEGGED_TOKENS = 15;

    MocCARC20 internal mocCARC20;
    GovernorMock internal governor;
    MocTC internal tcToken;
    ERC20Mock internal acToken;
    address internal mocFeeFlow;
    address internal mocAppreciationBeneficiary;

    uint256 internal totalPeggedTokensAdded;

    struct TCData {
        uint256 coverage;
        uint256 tcPrice;
        uint256 acBalanceSender;
        uint256 acBalanceMocFlow;
        uint256 tcBalanceSender;
    }

    constructor() payable {
        mocFeeFlow = address(1);
        mocAppreciationBeneficiary = address(2);
        governor = new GovernorMock();
        acToken = new ERC20Mock();
        tcToken = MocTC(_deployProxy(address(new MocTC())));
        mocCARC20 = MocCARC20(_deployProxy(address(new MocCARC20())));

        // initialize Collateral Token
        tcToken.initialize("TCToken", "TC", address(mocCARC20), governor);

        // initialize mocCore
        MocBaseBucket.InitializeBaseBucketParams memory initializeBaseBucketParams = MocBaseBucket
            .InitializeBaseBucketParams({
                tcTokenAddress: address(tcToken),
                mocFeeFlowAddress: mocFeeFlow,
                mocAppreciationBeneficiaryAddress: mocAppreciationBeneficiary,
                protThrld: 2 * PRECISION,
                liqThrld: 1 * PRECISION,
                feeRetainer: (2 * PRECISION) / 10, // 20%
                tcMintFee: (5 * PRECISION) / 100, // 5%
                tcRedeemFee: (5 * PRECISION) / 100, // 5%
                swapTPforTPFee: (1 * PRECISION) / 100, // 1%
                swapTPforTCFee: (1 * PRECISION) / 100, // 1%
                swapTCforTPFee: (1 * PRECISION) / 100, // 1%
                redeemTCandTPFee: (8 * PRECISION) / 100, // 8%
                mintTCandTPFee: (8 * PRECISION) / 100, // 8%
                successFee: (1 * PRECISION) / 10, // 10%
                appreciationFactor: (5 * PRECISION) / 10 // 50%
            });
        MocCore.InitializeCoreParams memory initializeCoreParams = MocCore.InitializeCoreParams({
            initializeBaseBucketParams: initializeBaseBucketParams,
            governorAddress: address(governor),
            pauserAddress: msg.sender,
            emaCalculationBlockSpan: 1 days,
            bes: 30 days
        });
        MocCARC20.InitializeParams memory initializeParams = MocCARC20.InitializeParams({
            initializeCoreParams: initializeCoreParams,
            acTokenAddress: address(acToken)
        });
        mocCARC20.initialize(initializeParams);

        // add a Pegged Token
        MocCore.PeggedTokenParams memory peggedTokenParams = MocCore.PeggedTokenParams({
            tpTokenAddress: address(0),
            priceProviderAddress: address(0),
            tpCtarg: 5 * PRECISION,
            tpMintFee: (5 * PRECISION) / 100, // 5%
            tpRedeemFee: (5 * PRECISION) / 100, // 5%
            tpEma: 212 * PRECISION,
            tpEmaSf: (5 * PRECISION) / 100 // 0.05
        });
        addPeggedToken(peggedTokenParams, 235 ether);

        // mint TC tokens to echidna
        acToken.mint(address(this), 30000 ether);
        acToken.approve(address(mocCARC20), 30000 ether);
        mocCARC20.mintTC(3000 ether, 30000 ether);

        // mint TP 0 tokens to echidna
        acToken.mint(address(this), 1000 ether);
        acToken.approve(address(mocCARC20), 1000 ether);
        mocCARC20.mintTP(0, 23500 ether, 1000 ether);
    }

    function addPeggedToken(MocCore.PeggedTokenParams memory peggedTokenParams_, uint96 price_) public {
        require(totalPeggedTokensAdded < MAX_PEGGED_TOKENS, "max TP already added");
        MocRC20 tpToken = MocRC20(_deployProxy(address(new MocRC20())));
        // initialize Pegged Token
        tpToken.initialize("TPToken", "TP", address(mocCARC20), governor);
        peggedTokenParams_.tpTokenAddress = address(tpToken);
        // price not 0
        price_++;
        peggedTokenParams_.priceProviderAddress = address(new PriceProviderMock(price_));
        mocCARC20.addPeggedToken(peggedTokenParams_);
        totalPeggedTokensAdded++;
    }

    function pokePrice(uint256 i_, uint96 price_) public {
        // price not 0
        price_++;
        (, IPriceProvider priceProvider) = mocCARC20.pegContainer(i_ % totalPeggedTokensAdded);
        PriceProviderMock(address(priceProvider)).poke(price_);
    }

    function mintTC(uint256 qTC_, uint256 qACmax_) public {
        if (qACmax_ > 0) {
            uint256 qACmaxIncludingFee = qACmax_ * (PRECISION + mocCARC20.tcMintFee());
            // mint tokens to this contract
            acToken.mint(address(this), qACmaxIncludingFee);
            acToken.increaseAllowance(address(mocCARC20), qACmaxIncludingFee);
            TCData memory tcDataBefore = _getTCData();
            // we don't want to revert if echidna sends insufficient qAC
            qTC_ = qTC_ % ((qACmax_ * PRECISION) / tcDataBefore.tcPrice);
            bool shouldRevert = tcDataBefore.coverage < mocCARC20.protThrld();
            bool reverted;
            try mocCARC20.mintTC(qTC_, qACmaxIncludingFee) returns (uint256 qACspent) {
                TCData memory tcDataAfter = _getTCData();
                uint256 qACusedToMint = (qTC_ * tcDataBefore.tcPrice) / PRECISION;
                uint256 fee = (qACusedToMint * mocCARC20.tcMintFee() * (PRECISION - mocCARC20.feeRetainer())) /
                    (PRECISION * PRECISION);

                // assert: qACspent should be qACusedToMint + qAC fee
                assert(qACspent == (qACusedToMint * (PRECISION + mocCARC20.tcMintFee())) / PRECISION);
                // assert: echidna AC balance should decrease by qAC spent
                assert(tcDataAfter.acBalanceSender == tcDataBefore.acBalanceSender - qACspent);
                // assert: Moc Flow balance should increase by qAC fee
                // use tolerance 1 because possible rounding errors
                assert(tcDataAfter.acBalanceMocFlow - tcDataBefore.acBalanceMocFlow - fee <= 1);
                // assert: echidna TC balance should increase by qTC
                assert(tcDataAfter.tcBalanceSender == tcDataBefore.tcBalanceSender + qTC_);
                // assert: during mintTC operation coverage always should increase
                assert(tcDataAfter.coverage >= tcDataBefore.coverage);
                // assert: after mintTC operation coverage always should be above protected threshold
                assert(tcDataAfter.coverage >= mocCARC20.protThrld());
                // assert: if mintTC should revert
                assert(!shouldRevert);
            } catch {
                reverted = true;
            }
            if (shouldRevert) assert(reverted);
        }
    }

    function redeemTC(uint256 qTC_) public {
        TCData memory tcDataBefore = _getTCData();
        if (tcDataBefore.tcBalanceSender > 0) {
            // we don't want to revert if echidna tries to redeem qTC that don´t have
            qTC_ = (qTC_ % tcDataBefore.tcBalanceSender) + 1;
            bool shouldRevert = tcDataBefore.coverage < mocCARC20.calcCtargemaCA() ||
                qTC_ > mocCARC20.getTCAvailableToRedeem();
            bool reverted;
            // qACmin_ = 0 because we don't want to revert if echidna asks for more qAC
            try mocCARC20.redeemTC(qTC_, 0) returns (uint256 qACRedeemed) {
                TCData memory tcDataAfter = _getTCData();
                uint256 qACTotalRedeemed = (qTC_ * tcDataBefore.tcPrice) / PRECISION;
                uint256 fee = (qACTotalRedeemed * mocCARC20.tcRedeemFee() * (PRECISION - mocCARC20.feeRetainer())) /
                    (PRECISION * PRECISION);
                // assert: qACRedeemed should be equal to qACTotalRedeemed - qAC fee
                assert(qACRedeemed - (qACTotalRedeemed * (PRECISION - mocCARC20.tcRedeemFee())) / PRECISION <= 1);
                // assert: echidna AC balance should increase by qAC redeemed
                assert(tcDataAfter.acBalanceSender == tcDataBefore.acBalanceSender + qACRedeemed);
                // assert: Moc Flow balance should increase by qAC fee
                // use tolerance 1 because possible rounding errors
                assert(tcDataAfter.acBalanceMocFlow - tcDataBefore.acBalanceMocFlow - fee <= 1);
                // assert: echidna TC balance should decrease by qTC
                assert(tcDataAfter.tcBalanceSender == tcDataBefore.tcBalanceSender - qTC_);
                // assert: during redeemTC operation coverage always should decrease
                assert(tcDataBefore.coverage >= tcDataAfter.coverage);
                // assert: after redeemTC operation coverage always should be above ctargemaCA
                assert(tcDataAfter.coverage >= mocCARC20.calcCtargemaCA());
                // assert: if redeemTC should revert
                assert(!shouldRevert);
            } catch {
                reverted = true;
            }
            if (shouldRevert) assert(reverted);
        }
    }

    function operTCWithoutBalance(uint256 qTC_) public {
        TCData memory tcDataBefore = _getTCData();
        uint256 qACmax = ((qTC_ * tcDataBefore.tcPrice) / PRECISION) - 1;
        acToken.increaseAllowance(address(mocCARC20), qACmax);
        // mintTC with insufficient qAC
        try mocCARC20.mintTC(qTC_, qACmax) {
            assert(false);
        } catch {
            // assert: tx should revert always
            assert(true);
        }
        if (tcDataBefore.tcBalanceSender < qTC_) {
            // redeemTC with insufficient qTC
            try mocCARC20.redeemTC(qTC_, 0) {
                assert(false);
            } catch {
                // assert: tx should revert always
                assert(true);
            }
        }
        TCData memory tcDataAfter = _getTCData();
        // assert: echidna AC balance should be the same
        assert(tcDataAfter.acBalanceSender == tcDataBefore.acBalanceSender);
        // assert: echidna TC balance should be the same
        assert(tcDataAfter.tcBalanceSender == tcDataBefore.tcBalanceSender);
    }

    function _deployProxy(address implementation) internal returns (address) {
        return address(new ERC1967Proxy(implementation, ""));
    }

    function _getTCData() internal view returns (TCData memory tcData) {
        tcData = TCData({
            coverage: mocCARC20.getCglb(),
            tcPrice: mocCARC20.getPTCac(),
            acBalanceSender: acToken.balanceOf(address(this)),
            acBalanceMocFlow: acToken.balanceOf(mocFeeFlow),
            tcBalanceSender: tcToken.balanceOf(address(this))
        });
    }

    function echidna_balance_not_drained() public view returns (bool) {
        return
            acToken.balanceOf(address(mocCARC20)) * mocCARC20.getCglb() >= mocCARC20.getPTCac() * tcToken.totalSupply();
    }

    function echidna_storage_consistency() public returns (bool) {
        mocCARC20.refreshACBalance();
        bool nAccbIsOk = acToken.balanceOf(address(mocCARC20)) == mocCARC20.nACcb();
        bool nTCcbIsOk = tcToken.totalSupply() == mocCARC20.nTCcb();
        bool nTPIsOk = true;
        for (uint256 i = 0; i < totalPeggedTokensAdded; i++) {
            (uint256 nTP, ) = mocCARC20.pegContainer(i);
            nTPIsOk = nTPIsOk && mocCARC20.tpTokens(i).totalSupply() == nTP;
        }
        return nAccbIsOk && nTCcbIsOk && nTPIsOk;
    }
}
