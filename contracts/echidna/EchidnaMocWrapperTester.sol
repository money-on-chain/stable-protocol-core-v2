// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocCAWrapper, MocCARC20 } from "../collateral/collateralBag/MocCAWrapper.sol";
import { MocCore, MocCoreExpansion, PeggedTokenParams } from "../core/MocCore.sol";
import { MocBaseBucket } from "../core/MocBaseBucket.sol";
import { MocTC } from "../tokens/MocTC.sol";
import { MocRC20 } from "../tokens/MocRC20.sol";
import { MocVendors } from "../vendors/MocVendors.sol";
import { GovernorMock } from "../mocks/upgradeability/GovernorMock.sol";
import { ERC20Mock } from "../mocks/ERC20Mock.sol";
import { PriceProviderMock } from "../mocks/PriceProviderMock.sol";
import { IPriceProvider } from "../interfaces/IPriceProvider.sol";
import { PriceProviderShifter } from "../utils/PriceProviderShifter.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title EchidnaMocWrapperTester
 * @notice This test purpose is to check that operating with assets with different decimals than 18 doesn't affect
 * the wrapped token price
 */
contract EchidnaMocWrapperTester {
    uint256 internal constant PRECISION = 10 ** 18;
    uint256 internal constant UINT256_MAX = ~uint256(0);

    uint256 internal constant MAX_PEGGED_TOKENS = 5;
    uint256 internal constant MAX_ASSETS = 5;

    MocCARC20 internal mocCARC20;
    GovernorMock internal governor;
    ERC20Mock internal feeToken;
    MocTC internal tcToken;
    IPriceProvider internal feeTokenPriceProvider;
    ERC20Mock internal acToken;
    MocVendors internal mocVendors;
    address internal mocCoreExpansion;
    address internal mocFeeFlow;
    address internal mocAppreciationBeneficiary;

    uint256 internal totalPeggedTokensAdded;

    MocCAWrapper internal mocWrapper;

    ERC20Mock[] internal assetsAdded;

    constructor() payable {
        mocFeeFlow = address(1);
        mocAppreciationBeneficiary = address(2);
        governor = new GovernorMock();
        acToken = new ERC20Mock();
        feeToken = new ERC20Mock();
        feeTokenPriceProvider = new PriceProviderMock(1 ether);
        tcToken = MocTC(_deployProxy(address(new MocTC())));
        mocCARC20 = MocCARC20(_deployProxy(address(new MocCARC20())));
        mocWrapper = MocCAWrapper(_deployProxy(address(new MocCAWrapper())));
        mocCoreExpansion = address(new MocCoreExpansion());
        mocVendors = MocVendors(_deployProxy(address(new MocVendors())));

        // initialize Vendors
        mocVendors.initialize(/*vendorGuardian */ msg.sender, address(governor), /*pauserAddress*/ msg.sender);

        // initialize Collateral Token
        tcToken.initialize("TCToken", "TC", address(mocCARC20), governor);

        // initialize mocCore
        MocBaseBucket.InitializeBaseBucketParams memory initializeBaseBucketParams = MocBaseBucket
            .InitializeBaseBucketParams({
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
                tcInterestPaymentBlockSpan: 7 days
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
        mocWrapper.initialize(address(governor), msg.sender, address(mocCARC20), address(acToken));

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
        addPeggedToken(peggedTokenParams, 235 ether);
        // start with 0 total supply
        acToken.burn(acToken.balanceOf(address(this)));

        addAsset(18);
        addAsset(6);
    }

    function addPeggedToken(PeggedTokenParams memory peggedTokenParams_, uint96 price_) public {
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

    function addAsset(uint8 decimals_) public {
        require(assetsAdded.length < MAX_ASSETS, "max assets already added");
        ERC20Mock asset = new ERC20Mock();
        // max decimals considered is 24
        uint8 decimals = decimals_ % 24;
        asset.setDecimals(decimals);

        mocWrapper.addOrEditAsset(
            asset,
            new PriceProviderShifter(new PriceProviderMock(1 ether), int8(18 - decimals)),
            decimals
        );
        assetsAdded.push(asset);
    }

    function mintTC(uint8 assetIndex_, uint256 qTC_) public {
        ERC20Mock asset = assetsAdded[assetIndex_ % assetsAdded.length];
        asset.mint(address(this), qTC_ * 2);
        asset.approve(address(mocWrapper), qTC_ * 2);
        mocWrapper.mintTC(address(asset), qTC_, qTC_ * 2);
    }

    function redeemTC(uint8 assetIndex_, uint256 qTC_) public {
        ERC20Mock asset = assetsAdded[assetIndex_ % assetsAdded.length];
        mocCARC20.tcToken().approve(address(mocWrapper), qTC_);
        mocWrapper.redeemTC(address(asset), qTC_, 0);
    }

    function _deployProxy(address implementation) internal returns (address) {
        return address(new ERC1967Proxy(implementation, ""));
    }

    function echidna_wrappedTokenPrice_always_ONE() public view returns (bool) {
        return mocWrapper.getTokenPrice() == PRECISION;
    }
}
