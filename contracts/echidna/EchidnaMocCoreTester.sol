pragma solidity ^0.8.17;

import "../collateral/collateralBag/MocCAWrapper.sol";
import "../collateral/rc20/MocCARC20.sol";
import "../MocSettlement.sol";
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
        mocSettlement = MocSettlement(_deployProxy(address(new MocSettlement())));
        tcToken = MocTC(_deployProxy(address(new MocTC())));
        mocCARC20 = MocCARC20(_deployProxy(address(new MocCARC20())));

        // initialize Collateral Token
        tcToken.initialize("TCToken", "TC", address(mocCARC20), governor);

        // initialize mocCore
        MocBaseBucket.InitializeBaseBucketParams memory initializeBaseBucketParams = MocBaseBucket
            .InitializeBaseBucketParams({
                tcTokenAddress: address(tcToken),
                mocSettlementAddress: address(mocSettlement),
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
            emaCalculationBlockSpan: 1 days
        });
        MocCARC20.InitializeParams memory initializeParams = MocCARC20.InitializeParams({
            initializeCoreParams: initializeCoreParams,
            acTokenAddress: address(acToken)
        });
        mocCARC20.initialize(initializeParams);

        // initialize mocSettlement
        mocSettlement.initialize(address(governor), msg.sender, mocCARC20, 30 days, 2);
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

    function mintTC(uint256 qTC_, uint256 qACmax_) public {
        acToken.mint(address(this), qACmax_);
        acToken.increaseAllowance(address(mocCARC20), qACmax_);

        uint256 balanceSenderBefore = acToken.balanceOf(address(this));
        mocCARC20.mintTC(qTC_, qACmax_);
        uint256 balanceSenderAfter = acToken.balanceOf(address(this));

        assert(balanceSenderAfter < balanceSenderBefore);
    }

    function _deployProxy(address implementation) internal returns (address) {
        return address(new ERC1967Proxy(implementation, ""));
    }
}
