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

contract EchidnaMocCoreTester {
    uint256 internal constant PRECISION = 10 ** 18;

    uint256 internal constant MAX_PEGGED_TOKENS = 15;

    MocCARC20 internal mocCARC20;
    MocSettlement internal mocSettlement;
    GovernorMock internal governor;
    MocTC internal tcToken;
    ERC20Mock internal acToken;
    address internal mocFeeFlow;
    address internal mocAppreciationBeneficiary;

    uint256 internal totalPeggedTokensAdded;

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
    }

    function addPeggedToken(MocCore.PeggedTokenParams memory peggedTokenParams_, uint256 price_) public {
        require(totalPeggedTokensAdded < MAX_PEGGED_TOKENS, "max TP already added");
        MocRC20 tpToken = MocRC20(_deployProxy(address(new MocRC20())));
        // initialize Pegged Token
        tpToken.initialize("TPToken", "TP", address(mocCARC20), governor);
        peggedTokenParams_.tpTokenAddress = address(tpToken);
        peggedTokenParams_.priceProviderAddress = address(new PriceProviderMock(price_));
        mocCARC20.addPeggedToken(peggedTokenParams_);
        totalPeggedTokensAdded++;
    }

    function pokePrice(uint256 i_, uint256 price_) public {
        (, IPriceProvider priceProvider) = mocCARC20.pegContainer(i_ % MAX_PEGGED_TOKENS);
        PriceProviderMock(address(priceProvider)).poke(price_);
    }

    function mintTC(uint256 qTC_, uint256 qACmax_) public virtual {
        if (qACmax_ > 0) {
            // mint tokens to this contract
            acToken.mint(address(this), qACmax_);
            acToken.increaseAllowance(address(mocCARC20), qACmax_);
            uint256 tcPrice = mocCARC20.getPTCac();
            // we don't want to revert if echidna sends insufficient qAC
            qTC_ = qTC_ % ((qACmax_ * PRECISION) / tcPrice);
            uint256 acBalanceSenderBefore = acToken.balanceOf(address(this));
            uint256 acBalanceMocFlowBefore = acToken.balanceOf(mocFeeFlow);
            uint256 tcBalanceSenderBefore = tcToken.balanceOf(address(this));
            uint256 coverageBefore = mocCARC20.getCglb();
            try mocCARC20.mintTC(qTC_, qACmax_) returns (uint256 qACspent) {
                uint256 acBalanceSenderAfter = acToken.balanceOf(address(this));
                uint256 acBalanceMocFlowAfter = acToken.balanceOf(mocFeeFlow);
                uint256 tcBalanceSenderAfter = tcToken.balanceOf(address(this));
                uint256 coverageAfter = mocCARC20.getCglb();
                uint256 qACusedToMint = (qTC_ * tcPrice) / PRECISION;
                uint256 fee = (qACusedToMint * mocCARC20.tcMintFee() * (PRECISION - mocCARC20.feeRetainer())) /
                    (PRECISION * PRECISION);

                // assert: qACspent should be qACusedToMint + qAC fee
                assert(qACspent == (qACusedToMint * (PRECISION + mocCARC20.tcMintFee())) / PRECISION);
                // assert: echidna AC balance should decrease by qAC spent
                assert(acBalanceSenderAfter == acBalanceSenderBefore - qACspent);
                // assert: Moc Flow balance should increase by qAC fee
                // use tolerance 1 because possible rounding errors
                assert(acBalanceMocFlowAfter - acBalanceMocFlowBefore - fee <= 1);
                // assert: echidna TC balance should increase by qTC
                assert(tcBalanceSenderAfter == tcBalanceSenderBefore + qTC_);
                // assert: during mintTC operation coverage always should increase
                // use tolerance 1 because possible rounding errors
                assert(coverageAfter - coverageBefore < 1);
                // assert: after mintTC operation coverage always should be above protected threshold
                assert(coverageAfter >= mocCARC20.protThrld());
            } catch {}
        }
    }

    function _deployProxy(address implementation) internal returns (address) {
        return address(new ERC1967Proxy(implementation, ""));
    }
}
