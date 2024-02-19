// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocCARC20 } from "../collateral/rc20/MocCARC20.sol";
import { MocCore, MocCoreExpansion, PeggedTokenParams } from "../core/MocCore.sol";
import { MocBaseBucket } from "../core/MocBaseBucket.sol";
import { MocQueue } from "../queue/MocQueue.sol";
import { MocQueueExecFees } from "../queue/MocQueueExecFees.sol";
import { MocTC } from "../tokens/MocTC.sol";
import { MocRC20 } from "../tokens/MocRC20.sol";
import { MocVendors } from "../vendors/MocVendors.sol";
import { GovernorMock } from "../mocks/upgradeability/GovernorMock.sol";
import { ERC20Mock } from "../mocks/ERC20Mock.sol";
import { PriceProviderMock } from "../mocks/PriceProviderMock.sol";
import { IPriceProvider } from "../interfaces/IPriceProvider.sol";
import { DataProviderMock } from "../mocks/DataProviderMock.sol";
import { IDataProvider } from "../interfaces/IDataProvider.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

bytes32 constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
uint256 constant EXEC_FEE = 100 wei;

contract EchidnaMocQueueTester {
    uint256 internal constant PRECISION = 10 ** 18;
    uint256 internal constant UINT256_MAX = ~uint256(0);

    uint256 internal constant MAX_PRICE = (10 ** 10) * PRECISION;

    MocCARC20 internal mocCARC20;
    MocQueue internal mocQueue;
    GovernorMock internal governor;
    ERC20Mock internal feeToken;
    IPriceProvider internal feeTokenPriceProvider;
    IDataProvider internal fluxCapacitorProvider;
    MocTC internal tcToken;
    ERC20Mock internal acToken;
    MocVendors internal mocVendors;
    address internal mocCoreExpansion;
    address internal mocFeeFlow;
    address internal mocAppreciationBeneficiary;
    address internal executionFeeRecipient;

    constructor() payable {
        mocFeeFlow = address(1);
        mocAppreciationBeneficiary = address(2);
        executionFeeRecipient = address(3);

        governor = new GovernorMock();
        acToken = new ERC20Mock();
        feeToken = new ERC20Mock();
        feeTokenPriceProvider = new PriceProviderMock(1 ether);
        fluxCapacitorProvider = new DataProviderMock(UINT256_MAX);
        tcToken = MocTC(_deployProxy(address(new MocTC())));
        mocCARC20 = MocCARC20(_deployProxy(address(new MocCARC20())));
        mocCoreExpansion = address(new MocCoreExpansion());
        mocVendors = MocVendors(_deployProxy(address(new MocVendors())));
        mocQueue = MocQueue(payable(_deployProxy(address(new MocQueue()))));

        // initialize Vendors
        mocVendors.initialize(/*vendorGuardian */ msg.sender, address(governor), /*pauserAddress*/ msg.sender);

        // initialize Collateral Token
        tcToken.initialize("TCToken", "TC", address(this), governor);

        // initialize mocCore
        MocBaseBucket.InitializeBaseBucketParams memory initializeBaseBucketParams = MocBaseBucket
            .InitializeBaseBucketParams({
                mocQueueAddress: payable(mocQueue),
                feeTokenAddress: address(feeToken),
                feeTokenPriceProviderAddress: address(feeTokenPriceProvider),
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
                feeTokenPct: (5 * PRECISION) / 10, // 50%
                successFee: (1 * PRECISION) / 10, // 10%
                appreciationFactor: (5 * PRECISION) / 10, // 50%
                bes: 30 days,
                tcInterestCollectorAddress: mocFeeFlow,
                tcInterestRate: (1 * PRECISION) / 10, // 0.1%
                tcInterestPaymentBlockSpan: 7 days,
                maxAbsoluteOpProviderAddress: address(fluxCapacitorProvider),
                maxOpDiffProviderAddress: address(fluxCapacitorProvider),
                decayBlockSpan: 720
            });
        MocCore.InitializeCoreParams memory initializeCoreParams = MocCore.InitializeCoreParams({
            initializeBaseBucketParams: initializeBaseBucketParams,
            governorAddress: address(governor),
            pauserAddress: msg.sender,
            mocCoreExpansion: mocCoreExpansion,
            emaCalculationBlockSpan: 1 days,
            mocVendors: address(mocVendors)
        });
        MocCARC20.InitializeParams memory initializeParams = MocCARC20.InitializeParams({
            initializeCoreParams: initializeCoreParams,
            acTokenAddress: address(acToken)
        });
        mocCARC20.initialize(initializeParams);

        // initialize mocQueue
        mocQueue.initialize(
            address(governor), // governor
            msg.sender, // pauser
            10, // minOperWaitingBlk
            10, // maxOperPerBatch
            MocQueueExecFees.InitializeMocQueueExecFeesParams({
                tcMintExecFee: EXEC_FEE,
                tcRedeemExecFee: EXEC_FEE,
                tpMintExecFee: EXEC_FEE,
                tpRedeemExecFee: EXEC_FEE,
                swapTPforTPExecFee: EXEC_FEE,
                swapTPforTCExecFee: EXEC_FEE,
                swapTCforTPExecFee: EXEC_FEE,
                redeemTCandTPExecFee: EXEC_FEE,
                mintTCandTPExecFee: EXEC_FEE
            })
        );
        mocQueue.registerBucket(mocCARC20);
        mocQueue.grantRole(EXECUTOR_ROLE, address(this));

        // transfer roles to mocCARC20
        tcToken.transferAllRoles(address(mocCARC20));

        // add a Pegged Token
        PeggedTokenParams memory peggedTokenParams = PeggedTokenParams({
            tpTokenAddress: address(0),
            priceProviderAddress: address(0),
            tpCtarg: 5 * PRECISION,
            tpMintFee: (5 * PRECISION) / 100, // 5%
            tpRedeemFee: (5 * PRECISION) / 100, // 5%
            tpEma: 212 * PRECISION,
            tpEmaSf: (5 * PRECISION) / 100 // 0.05
        });
        _addPeggedToken(peggedTokenParams, 235 ether);

        // mint all Collateral Asset to echidna
        acToken.mint(address(this), UINT256_MAX - acToken.totalSupply());

        // mint TC tokens to echidna
        acToken.approve(address(mocCARC20), 30000 ether);
        mocCARC20.mintTC{ value: EXEC_FEE }(3000 ether, 30000 ether);

        // mint TP 0 tokens to echidna
        acToken.approve(address(mocCARC20), 1000 ether);
        address tp0 = address(mocCARC20.tpTokens(0));
        mocCARC20.mintTP{ value: EXEC_FEE }(tp0, 23500 ether, 1000 ether);
    }

    function _addPeggedToken(PeggedTokenParams memory peggedTokenParams_, uint96 price_) internal {
        MocRC20 tpToken = MocRC20(_deployProxy(address(new MocRC20())));
        // initialize Pegged Token
        tpToken.initialize("TPToken", "TP", address(mocCARC20), governor);
        peggedTokenParams_.tpTokenAddress = address(tpToken);
        peggedTokenParams_.tpMintFee = peggedTokenParams_.tpMintFee % PRECISION;
        peggedTokenParams_.tpRedeemFee = peggedTokenParams_.tpRedeemFee % PRECISION;
        // price not 0
        price_++;
        peggedTokenParams_.priceProviderAddress = address(new PriceProviderMock(price_));
        mocCARC20.addPeggedToken(peggedTokenParams_);
    }

    function pokePrice(uint96 price_) public {
        // price not 0
        price_++;
        (, IPriceProvider priceProvider) = mocCARC20.pegContainer(0);
        PriceProviderMock(address(priceProvider)).poke(price_);
    }

    function mintTC(uint256 qTC_, uint256 qACmax_) public virtual {
        mocCARC20.mintTC{ value: EXEC_FEE }(qTC_, qACmax_);
    }

    function redeemTC(uint256 qTC_) public virtual {
        mocCARC20.redeemTC{ value: EXEC_FEE }(qTC_, 0);
    }

    function mintTP(uint256 qTP_, uint256 qACmax_) public {
        address tpi = address(mocCARC20.tpTokens(0));
        mocCARC20.mintTP{ value: EXEC_FEE }(tpi, qTP_, qACmax_);
    }

    function redeemTP(uint256 qTP_) public {
        address tpi = address(mocCARC20.tpTokens(0));
        mocCARC20.redeemTP{ value: EXEC_FEE }(tpi, qTP_, 0);
    }

    function execute() public {
        require(!mocQueue.isEmpty());

        uint256 executionFeeRecipientBalanceBefore = executionFeeRecipient.balance;
        uint256 tcBalanceBefore = tcToken.balanceOf(address(this));
        uint256 tpBalanceBefore = mocCARC20.tpTokens(0).balanceOf(address(this));
        uint256 operIdBefore = mocQueue.firstOperId();

        mocQueue.execute(executionFeeRecipient);

        uint256 executionFeeRecipientBalanceAfter = executionFeeRecipient.balance;
        uint256 tcBalanceAfter = tcToken.balanceOf(address(this));
        uint256 tpBalanceAfter = mocCARC20.tpTokens(0).balanceOf(address(this));
        uint256 operIdAfter = mocQueue.firstOperId();

        // some operation has to succeed
        require(tcBalanceBefore != tcBalanceAfter || tpBalanceBefore != tpBalanceAfter);

        uint256 operAmount = operIdAfter - operIdBefore;
        assert(operAmount <= mocQueue.maxOperPerBatch());
        assert(executionFeeRecipientBalanceAfter - executionFeeRecipientBalanceBefore == EXEC_FEE * operAmount);
        assert(mocCARC20.getCglb() >= mocCARC20.calcCtargemaCA());
    }

    function _deployProxy(address implementation) internal returns (address) {
        return address(new ERC1967Proxy(implementation, ""));
    }

    // TODO: add flux capacitor invariant
}
