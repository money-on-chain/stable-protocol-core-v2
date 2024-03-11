// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocTC, IMocRC20 } from "../tokens/MocTC.sol";
import { IPriceProvider } from "../interfaces/IPriceProvider.sol";
import { IDataProvider } from "../interfaces/IDataProvider.sol";
import { MocUpgradable } from "../governance/MocUpgradable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MocBaseBucket: Moc Collateral Bag
 * @notice MocBaseBucket holds Bucket Zero state, both for the Collateral Bag and PeggedTokens Items.
 * @dev Abstracts all rw operations on the main bucket and expose all calculations relative to its state.
 */
abstract contract MocBaseBucket is MocUpgradable {
    // ------- Events -------

    event ContractLiquidated();

    // ------- Custom Errors -------
    error MissingProviderPrice(address priceProviderAddress_);
    error Liquidated();
    error LowCoverage(uint256 cglb_, uint256 covThrld_);
    error RecipientMustBeSender();

    // ------- Structs -------
    struct PegContainerItem {
        // total supply of Pegged Token
        uint256 nTP;
        // PegToken PriceFeed address
        IPriceProvider priceProvider;
    }

    struct PeggedTokenIndex {
        // Pegged Token index
        uint256 index;
        // true if Pegged Token exists
        bool exists;
    }

    struct InitializeBaseBucketParams {
        // MocQueue contract address
        address payable mocQueueAddress;
        // Fee Token contract address
        address feeTokenAddress;
        // Fee Token price provider address
        address feeTokenPriceProviderAddress;
        // Collateral Token contract address
        address tcTokenAddress;
        // Moc Fee Flow contract address
        address mocFeeFlowAddress;
        // moc appreciation beneficiary Address
        address mocAppreciationBeneficiaryAddress;
        // protected state threshold [PREC]
        uint256 protThrld;
        // liquidation coverage threshold [PREC]
        uint256 liqThrld;
        // pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
        uint256 feeRetainer;
        // additional fee pct applied on mint Collateral Tokens operations [PREC]
        uint256 tcMintFee;
        // additional fee pct applied on redeem Collateral Tokens operations [PREC]
        uint256 tcRedeemFee;
        // additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
        uint256 swapTPforTPFee;
        // additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
        uint256 swapTPforTCFee;
        // additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
        uint256 swapTCforTPFee;
        // additional fee pct applied on redeem Collateral Token and Pegged Token in one operations [PREC]
        uint256 redeemTCandTPFee;
        // additional fee pct applied on mint Collateral Token and Pegged Token in one operation [PREC]
        uint256 mintTCandTPFee;
        // pct applied on the top of the operation`s fee when using Fee Token as fee payment method [PREC]
        // e.g. if tcMintFee = 1%, feeTokenPct = 50% => qFeeToken = 0.5%
        uint256 feeTokenPct;
        // pct of the gain because Pegged Tokens devaluation that is transferred
        // in Collateral Asset to Moc Fee Flow during the settlement [PREC]
        uint256 successFee;
        // pct of the gain because Pegged Tokens devaluation that is returned
        // in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
        uint256 appreciationFactor;
        // number of blocks between settlements
        uint256 bes;
        // TC interest collector address
        address tcInterestCollectorAddress;
        // pct interest charged to TC holders on the total collateral in the protocol [PREC]
        uint256 tcInterestRate;
        // amount of blocks to wait for next TC interest payment
        uint256 tcInterestPaymentBlockSpan;
        // max absolute operation provider address:
        //  absolute maximum transaction allowed for a certain number of blocks
        //  if absoluteAccumulator is above the value provided the operation will be rejected
        address maxAbsoluteOpProviderAddress;
        // max operation difference provider address:
        //  differential maximum transaction allowed for a certain number of blocks
        //  if operationalDifference is above the value provided the operation will be rejected
        address maxOpDiffProviderAddress;
        // number of blocks that have to elapse for the linear decay factor to be 0
        uint256 decayBlockSpan;
        // flag to allow users operate using another address as the recipient of the tokens
        bool allowDifferentRecipient;
    }

    // ------- Storage -------

    // Fee Token
    IERC20 public feeToken;
    // Fee Token price provider
    IPriceProvider public feeTokenPriceProvider;
    // total amount of Collateral Asset held in the Collateral Bag
    // WARN: On RC20 implementation, this correlates with contract acBalance
    uint256 public nACcb;
    // amount of Collateral Asset that the Vaults owe to the Collateral Bag
    // this variable is not used and is reserved for a future upgrade of the protocol
    // slither-disable-next-line constable-states
    uint256 internal nACioucb;

    // Collateral Token
    MocTC public tcToken;
    // Collateral Token in the Collateral Bag
    uint256 public nTCcb;

    // Pegged Tokens MocRC20 addresses
    IMocRC20[] public tpTokens;
    // Pegged Token indexes
    mapping(address => PeggedTokenIndex) public peggedTokenIndex;
    // peg container
    PegContainerItem[] public pegContainer;
    // Pegged Token prices, at which they can be redeemed after liquidation event
    uint256[] public tpLiqPrices;
    // pct of the gain because Pegged Tokens devaluation that is transferred
    // in Collateral Asset to Moc Fee Flow during the settlement [PREC]
    uint256 public successFee;
    // pct of the gain because Pegged Tokens devaluation that is returned
    // in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
    uint256 public appreciationFactor;

    // ------- Storage Fees -------

    // pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
    uint256 public feeRetainer; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on Collateral Tokens mint [PREC]
    uint256 public tcMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on Collateral Tokens redeem [PREC]
    uint256 public tcRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
    uint256 public swapTPforTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
    uint256 public swapTPforTCFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
    uint256 public swapTCforTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on redeem Collateral Token and Pegged Token in one operations [PREC]
    uint256 public redeemTCandTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on mint Collateral Token and Pegged Token in one operation [PREC]
    uint256 public mintTCandTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // pct applied on the top of the operation`s fee when using Fee Token as fee payment method [PREC]
    // e.g. if tcMintFee = 1%, FeeTokenPct = 50% => qFeeToken = 0.5%
    uint256 public feeTokenPct; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Pegged Token => addition fee pct applied on TP mint [PREC]
    mapping(address => uint256) public tpMintFees; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // Pegged Token =>  addition fee pct applied on TP redeem [PREC]
    mapping(address => uint256) public tpRedeemFees; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Moc Fee Flow contract address
    address public mocFeeFlowAddress;
    // Moc appreciation beneficiary address
    address public mocAppreciationBeneficiaryAddress;

    // ------- Storage Coverage Tracking -------

    // Target coverage for each Pegged Token [PREC]
    uint256[] public tpCtarg;
    // Coverage protected state threshold [PREC]
    uint256 public protThrld;
    // Coverage liquidation threshold [PREC]
    uint256 public liqThrld;
    // Liquidation enabled
    bool public liqEnabled;
    // Irreversible state, peg lost, contract is terminated and all funds can be withdrawn
    bool public liquidated;
    // flag to allow users operate using another address as the recipient of the tokens
    bool internal allowDifferentRecipient;

    // ------- Storage Settlement -------

    // number of blocks between settlements
    uint256 public bes;
    // next settlement block
    uint256 public bns;

    // ------- Storage Queue -------

    // amount of AC locked on MocQueue for pending operations
    uint256 public qACLockedInPending;
    // address for MocQueue contract
    address payable public mocQueue; // cannot used MocQueue, import failed due circular reference

    // ------- Storage Success Fee Tracking -------

    // profit and loss in collateral asset for each Pegged Token because its devaluation [N]
    // if it is positive it is a profit that will be distributed and reset during settlement
    int256[] internal tpiou;
    // Pegged Token price used at last operation(redeem or mint) [PREC]
    uint256[] internal pACtpLstop;

    // ------- Storage Flux Capacitor -------

    // max absolute operation provider:
    //  absolute maximum transaction allowed for a certain number of blocks
    //  if absoluteAccumulator is above the value provided the operation will be rejected
    IDataProvider public maxAbsoluteOpProvider;
    // max operation difference provider:
    //  differential maximum transaction allowed for a certain number of blocks
    //  if operationalDifference is above the value provided the operation will be rejected
    IDataProvider public maxOpDiffProvider;
    // number of blocks that have to elapse for the linear decay factor to be 0
    uint256 public decayBlockSpan;
    // accumulator increased by minting and redeeming TP operations
    uint256 public absoluteAccumulator;
    // accumulator increased by minting and decreased by redeeming TP operations
    int256 public differentialAccumulator;
    // last block number where an operation was submitted
    uint256 public lastOperationBlockNumber;

    // ------- Storage TC Holders Interest Payment -------

    // TC interest collector address
    address public tcInterestCollectorAddress;
    // pct interest charged to TC holders on the total collateral in the protocol [PREC]
    uint256 public tcInterestRate;
    // amount of blocks to wait for next TC interest payment
    uint256 public tcInterestPaymentBlockSpan;
    // next TC interest payment block number
    uint256 public nextTCInterestPayment;

    // ------- Modifiers -------
    /// @notice functions with this modifier reverts being in liquidated state
    modifier notLiquidated() {
        _checkLiquidated();
        _;
    }

    /// @notice functions with this modifier reverts if recipient is another address and is not allowed
    modifier checkRecipient(address sender_, address recipient_) {
        _checkRecipient(sender_, recipient_);
        _;
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param initializeBaseBucketParams_ contract initializer params
     * @dev   mocQueueAddress address for MocQueue contract
     *        feeTokenAddress Fee Token contract address
     *        feeTokenPriceProviderAddress Fee Token price provider contract address
     *        tcTokenAddress Collateral Token contract address
     *        mocFeeFlowAddress Moc Fee Flow contract address
     *        mocAppreciationBeneficiaryAddress Moc appreciation beneficiary address
     *        protThrld protected coverage threshold [PREC]
     *        liqThrld liquidation coverage threshold [PREC]
     *        feeRetainer pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
     *        tcMintFee additional fee pct applied on mint Collateral Tokens operations [PREC]
     *        tcRedeemFee additional fee pct applied on redeem Collateral Tokens operations [PREC]
     *        swapTPforTPFee additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
     *        swapTPforTCFee additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
     *        swapTCforTPFee additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
     *        redeemTCandTPFee additional fee pct applied on redeem Collateral Token and Pegged Token [PREC]
     *        mintTCandTPFee additional fee pct applied on mint Collateral Token and Pegged Token [PREC]
     *        feeTokenPct pct applied on the top of the operation`s fee when using
     *          Fee Token as fee payment method [PREC]
     *        successFee pct of the gain because Pegged Tokens devaluation that is transferred
     *          in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     *        appreciationFactor pct of the gain because Pegged Tokens devaluation that is returned
     *          in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
     *        bes number of blocks between settlements
     *        tcInterestCollectorAddress TC interest collector address
     *        tcInterestRate pct interest charged to TC holders on the total collateral in the protocol [PREC]
     *        tcInterestPaymentBlockSpan amount of blocks to wait for next TC interest payment
     *        maxAbsoluteOpProviderAddress max absolute operation provider address
     *        maxOpDiffProviderAddress max operation difference provider address
     *        decayBlockSpan number of blocks that have to elapse for the linear decay factor to be 0
     *        allowDifferentRecipient flag to allow users operate using another address as the recipient of the tokens
     */
    function __MocBaseBucket_init_unchained(
        InitializeBaseBucketParams calldata initializeBaseBucketParams_
    ) internal onlyInitializing {
        if (initializeBaseBucketParams_.protThrld <= ONE) revert InvalidValue();
        _checkLessThanOne(initializeBaseBucketParams_.feeRetainer);
        _checkLessThanOne(initializeBaseBucketParams_.tcMintFee);
        _checkLessThanOne(initializeBaseBucketParams_.tcRedeemFee);
        _checkLessThanOne(initializeBaseBucketParams_.swapTPforTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.swapTPforTCFee);
        _checkLessThanOne(initializeBaseBucketParams_.swapTCforTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.redeemTCandTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.mintTCandTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.feeTokenPct);
        _checkLessThanOne(initializeBaseBucketParams_.successFee + initializeBaseBucketParams_.appreciationFactor);
        mocQueue = initializeBaseBucketParams_.mocQueueAddress;
        feeToken = IERC20(initializeBaseBucketParams_.feeTokenAddress);
        feeTokenPriceProvider = IPriceProvider(initializeBaseBucketParams_.feeTokenPriceProviderAddress);
        tcToken = MocTC(initializeBaseBucketParams_.tcTokenAddress);
        mocFeeFlowAddress = initializeBaseBucketParams_.mocFeeFlowAddress;
        mocAppreciationBeneficiaryAddress = initializeBaseBucketParams_.mocAppreciationBeneficiaryAddress;
        protThrld = initializeBaseBucketParams_.protThrld;
        liqThrld = initializeBaseBucketParams_.liqThrld;
        feeRetainer = initializeBaseBucketParams_.feeRetainer;
        tcMintFee = initializeBaseBucketParams_.tcMintFee;
        tcRedeemFee = initializeBaseBucketParams_.tcRedeemFee;
        swapTPforTPFee = initializeBaseBucketParams_.swapTPforTPFee;
        swapTPforTCFee = initializeBaseBucketParams_.swapTPforTCFee;
        swapTCforTPFee = initializeBaseBucketParams_.swapTCforTPFee;
        redeemTCandTPFee = initializeBaseBucketParams_.redeemTCandTPFee;
        mintTCandTPFee = initializeBaseBucketParams_.mintTCandTPFee;
        feeTokenPct = initializeBaseBucketParams_.feeTokenPct;
        successFee = initializeBaseBucketParams_.successFee;
        appreciationFactor = initializeBaseBucketParams_.appreciationFactor;
        bes = initializeBaseBucketParams_.bes;
        tcInterestCollectorAddress = initializeBaseBucketParams_.tcInterestCollectorAddress;
        tcInterestRate = initializeBaseBucketParams_.tcInterestRate;
        tcInterestPaymentBlockSpan = initializeBaseBucketParams_.tcInterestPaymentBlockSpan;
        maxAbsoluteOpProvider = IDataProvider(initializeBaseBucketParams_.maxAbsoluteOpProviderAddress);
        maxOpDiffProvider = IDataProvider(initializeBaseBucketParams_.maxOpDiffProviderAddress);
        decayBlockSpan = initializeBaseBucketParams_.decayBlockSpan;
        lastOperationBlockNumber = block.number;
        unchecked {
            bns = block.number + initializeBaseBucketParams_.bes;
            nextTCInterestPayment = block.number + initializeBaseBucketParams_.tcInterestPaymentBlockSpan;
        }
        liquidated = false;
        liqEnabled = false;
        allowDifferentRecipient = initializeBaseBucketParams_.allowDifferentRecipient;
    }

    // ------- Internal Functions -------

    /**
     * reverts if in liquidated state
     */
    function _checkLiquidated() internal view {
        if (liquidated) revert Liquidated();
    }

    /**
     * reverts if recipient is another address and is not allowed
     */
    function _checkRecipient(address sender_, address recipient_) internal view {
        if (!allowDifferentRecipient && sender_ != recipient_) revert RecipientMustBeSender();
    }

    /**
     * @notice Adds Collateral Asset to the Bucket
     * @param qAC_ amount of Collateral Asset to add
     */
    function _depositAC(uint256 qAC_) internal {
        nACcb += qAC_;
    }

    /**
     * @notice Adds Collateral Token and Collateral Asset to the Bucket
     * @param qTC_ amount of Collateral Token to add
     * @param qAC_ amount of Collateral Asset to add
     */
    function _depositTC(uint256 qTC_, uint256 qAC_) internal {
        nTCcb += qTC_;
        _depositAC(qAC_);
    }

    /**
     * @notice Subtracts Collateral Token and Collateral Asset from the Bucket
     * @param qTC_ amount of Collateral Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawTC(uint256 qTC_, uint256 qAC_) internal {
        nTCcb -= qTC_;
        nACcb -= qAC_;
    }

    /**
     * @notice Adds Pegged Token and Collateral Asset to the Bucket
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to add
     * @param qAC_ amount of Collateral Asset to add
     */
    function _depositTP(uint256 i_, uint256 qTP_, uint256 qAC_) internal {
        pegContainer[i_].nTP += qTP_;
        _depositAC(qAC_);
    }

    /**
     * @notice Subtracts Pegged Token and Collateral Asset from the Bucket
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawTP(uint256 i_, uint256 qTP_, uint256 qAC_) internal {
        pegContainer[i_].nTP -= qTP_;
        nACcb -= qAC_;
    }

    /**
     * @notice Adds Pegged Token and Collateral Asset to the Bucket and mints `qTP_` for Pegged Token `i_`
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to add
     * @param qAC_ amount of Collateral Asset to add
     * @param recipient_ the account to mint tokens to
     */
    function _depositAndMintTP(uint256 i_, uint256 qTP_, uint256 qAC_, address recipient_) internal {
        // add qTP and qAC to the Bucket
        _depositTP(i_, qTP_, qAC_);
        // mint qTP to the recipient
        // slither-disable-next-line unused-return
        tpTokens[i_].mint(recipient_, qTP_);
    }

    /**
     * @notice subtracts Pegged Token and Collateral Asset from the Bucket and burns `qTP_` for Pegged Token `i_`
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawAndBurnTP(uint256 i_, uint256 qTP_, uint256 qAC_) internal {
        // sub qTP and qAC from the Bucket
        _withdrawTP(i_, qTP_, qAC_);
        // burn the qTp previously locked from the user
        // slither-disable-next-line unused-return
        tpTokens[i_].burn(address(this), qTP_);
    }

    /**
     * @notice Adds Collateral Token and Collateral Asset to the Bucket and mints qTCtoMint
     * @param qTC_ amount of Collateral Token to add
     * @param qAC_ amount of Collateral Asset to add
     * @param recipient_ the account to mint tokens to
     */
    function _depositAndMintTC(uint256 qTC_, uint256 qAC_, address recipient_) internal {
        // add qTC to the Bucket
        _depositTC(qTC_, qAC_);
        // mint qTC to the recipient
        // slither-disable-next-line unused-return
        tcToken.mint(recipient_, qTC_);
    }

    /**
     * @notice Subtracts Collateral Token and Collateral Asset from the Bucket and burns `qTC_`
     * @param qTC_ amount of Collateral Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawAndBurnTC(uint256 qTC_, uint256 qAC_) internal {
        // sub qTC and qAC from the Bucket
        _withdrawTC(qTC_, qAC_);
        // burn the qTC previously locked from the user
        tcToken.burn(address(this), qTC_);
    }

    /**
     * @notice get amount of Collateral Asset available considering how many are locked by Pegged Token adjusted by EMA
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return lckACemaAdjusted [PREC]
     */
    function _getLckACemaAdjusted(
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view returns (int256 lckACemaAdjusted) {
        // [PREC] = [N] * [PREC] - [PREC] * [N]
        return int256(_getTotalACavailable(nACgain_) * PRECISION) - int256(ctargemaCA_ * lckAC_);
    }

    /**
     * @notice get amount of Collateral Token available to redeem
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return tcAvailableToRedeem [N]
     */
    function _getTCAvailableToRedeem(
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view virtual returns (uint256 tcAvailableToRedeem) {
        // [PREC]
        int256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_, nACgain_);
        if (lckACemaAdjusted <= 0) return 0;
        // [N] = [PREC] / [PREC]
        return uint256(lckACemaAdjusted) / _getPTCac(lckAC_, nACgain_);
    }

    /**
     * @notice get signed amount of Pegged Token available to mint
     * @dev negative value is needed for multi collateral implementation
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset
     * @param ctargemaTP_ target coverage adjusted by the moving average of the value of a Pegged Token
     * @param pACtp_ Collateral Asset price in amount of Pegged Token [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return tpAvailableToMint [N]
     */
    function _getTPAvailableToMintSigned(
        uint256 ctargemaCA_,
        uint256 ctargemaTP_,
        uint256 pACtp_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view returns (int256 tpAvailableToMint) {
        int256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_, nACgain_);
        // [N] = [PREC] * [PREC] / ([PREC]) * [PREC])
        return (lckACemaAdjusted * int256(pACtp_)) / int256((ctargemaTP_ - ONE) * PRECISION);
    }

    /**
     * @notice get amount of Pegged Token available to mint
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset
     * @param ctargemaTP_ target coverage adjusted by the moving average of the value of a Pegged Token
     * @param pACtp_ Collateral Asset price in amount of Pegged Token [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return tpAvailableToMint [N]
     */
    function _getTPAvailableToMint(
        uint256 ctargemaCA_,
        uint256 ctargemaTP_,
        uint256 pACtp_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view virtual returns (uint256 tpAvailableToMint) {
        int256 tpAvailableToMintSigned = _getTPAvailableToMintSigned(
            ctargemaCA_,
            ctargemaTP_,
            pACtp_,
            lckAC_,
            nACgain_
        );
        if (tpAvailableToMintSigned < 0) return 0;
        return uint256(tpAvailableToMintSigned);
    }

    /**
     * @notice evaluates whether or not the coverage is over the cThrld_, reverts if below
     * @param cThrld_ coverage threshold to check for [PREC]
     * @param pACtps_ array of all AC prices for each TP, with [PREC]
     * @return lckAC amount of Collateral Asset locked by Pegged Tokens [PREC]
     * @return nACgain amount of collateral asset to be distributed during settlement [N]
     */
    function _evalCoverage(
        uint256 cThrld_,
        uint256[] memory pACtps_
    ) internal view returns (uint256 lckAC, uint256 nACgain) {
        (lckAC, nACgain) = _calcLckACandACgain(pACtps_);
        uint256 cglb = _getCglb(lckAC, nACgain);
        // check if coverage is above the given threshold
        if (cglb <= cThrld_) revert LowCoverage(cglb, cThrld_);
    }

    /**
     * @dev Calculates price at liquidation event as a relation between Pegs total supply
     * and the amount of Asset Collateral available to distribute
     */
    function settleLiquidationPrices() internal {
        // Total amount of AC available to be redeemed
        uint256 totalACAvailable = nACcb;
        // slither-disable-next-line incorrect-equality
        if (totalACAvailable == 0) return;
        uint256 pegAmount = pegContainer.length;
        // this could be get by getLckAC(), but given the prices are needed after,
        // it's better to cache them here.
        uint256 lckAC;
        // Auxiliary cache of pegs pACtp
        uint256[] memory pACtps = new uint256[](pegAmount);
        // for each peg, calculates the proportion of AC reserves it's locked

        for (uint256 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            pACtps[i] = _getPACtp(i);
            // [N] = [N] * [PREC] / [PREC]
            lckAC += _divPrec(pegContainer[i].nTP, pACtps[i]);
        }
        for (uint256 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            // [PREC] = [PREC] * [N] / [N];
            tpLiqPrices.push((pACtps[i] * lckAC) / totalACAvailable);
        }
    }

    /**
     * @notice updates Pegged Token P&L and last operation price
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     */
    function _updateTPtracking(uint256 i_, uint256 pACtp_) internal {
        tpiou[i_] += _calcOtfPnLTP(i_, pACtp_);
        pACtpLstop[i_] = pACtp_;
    }

    /**
     * @notice calculates on the fly Pegged Token P&L
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     * @return otfPnLtp [N]
     */
    function _calcOtfPnLTP(uint256 i_, uint256 pACtp_) internal view returns (int256 otfPnLtp) {
        // [PREC] = [N] * [PREC]
        uint256 nTP = pegContainer[i_].nTP * PRECISION;
        // [N] = [PREC] / [PREC] - [PREC] / [PREC]
        return int256(nTP / pACtpLstop[i_]) - int256(nTP / pACtp_);
    }

    /**
     * @notice gets accumulated Pegged Token P&L
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     * @return tpGain amount of Pegged Token to be minted during settlement [N]
     * @return adjPnLtpi total amount of P&L in Collateral Asset [N]
     */
    function _getPnLTP(uint256 i_, uint256 pACtp_) internal view returns (uint256 tpGain, uint256 adjPnLtpi) {
        // [N] = [N] + [N]
        int256 adjPnLtpiAux = tpiou[i_] + _calcOtfPnLTP(i_, pACtp_);
        if (adjPnLtpiAux > 0) {
            adjPnLtpi = uint256(adjPnLtpiAux);
            // [N] = (([PREC] * [PREC] / [PREC]) * [N]) / [PREC]
            tpGain = _mulPrec(_mulPrec(appreciationFactor, pACtp_), adjPnLtpi);
        }
        return (tpGain, adjPnLtpi);
    }

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token and
     *  amount of collateral asset to be distributed during settlement
     * @return lckAC [N]
     * @return nACgain [N]
     */
    function _getLckACandACgain() internal view returns (uint256 lckAC, uint256 nACgain) {
        uint256[] memory pACtps = _getPACtps();
        return _calcLckACandACgain(pACtps);
    }

    /**
     * @notice calculates the amount of Collateral Asset locked by Pegged Token and
     *  amount of collateral asset to be distributed during settlement
     * @param pACtps_ array of all AC prices for each TP, with [PREC]
     * @return lckAC [N]
     * @return nACgain [N]
     */
    function _calcLckACandACgain(uint256[] memory pACtps_) internal view returns (uint256 lckAC, uint256 nACgain) {
        uint256 pegAmount = pegContainer.length;
        for (uint256 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 pACtp = pACtps_[i];
            (uint256 tpGain, uint256 adjPnLtpi) = _getPnLTP(i, pACtp);
            // [N] = ([N] + [N]) * [PREC] / [PREC]
            lckAC += _divPrec(pegContainer[i].nTP + tpGain, pACtp);
            nACgain += adjPnLtpi;
        }
        // [N] = [N] * [PREC] / [PREC]
        nACgain = _mulPrec(nACgain, successFee);
        return (lckAC, nACgain);
    }

    /**
     * @notice get total Collateral Asset available
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return totalACavailable [N]
     */
    function _getTotalACavailable(uint256 nACgain_) internal view returns (uint256 totalACavailable) {
        // [N] = [N] - [N]
        return nACcb - nACgain_;
    }

    /**
     * @notice get Collateral Token price
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return pTCac [PREC]
     */
    function _getPTCac(uint256 lckAC_, uint256 nACgain_) internal view returns (uint256 pTCac) {
        // slither-disable-next-line incorrect-equality
        if (nTCcb == 0) return ONE;
        // [PREC] = ([N] - [N]) * [PREC]) / [N]
        return _divPrec((_getTotalACavailable(nACgain_) - lckAC_), nTCcb);
    }

    /**
     * @notice get Collateral Token leverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return leverageTC [PREC]
     */
    function _getLeverageTC(uint256 lckAC_, uint256 nACgain_) internal view returns (uint256 leverageTC) {
        uint256 totalACavailable = _getTotalACavailable(nACgain_);
        // [PREC] = [N] * [PREC] / ([N] - [N])
        return _divPrec(totalACavailable, totalACavailable - lckAC_);
    }

    /**
     * @notice get bucket global coverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return cglob [PREC]
     */
    function _getCglb(uint256 lckAC_, uint256 nACgain_) internal view virtual returns (uint256 cglob) {
        // slither-disable-next-line incorrect-equality
        if (lckAC_ == 0) return UINT256_MAX;
        // [PREC] = [N] * [PREC] / [N]
        return _divPrec(_getTotalACavailable(nACgain_), lckAC_);
    }

    function _tpi(address tpAddress) internal view returns (uint256) {
        PeggedTokenIndex storage ptIndex = peggedTokenIndex[tpAddress];
        if (!ptIndex.exists) revert InvalidAddress();
        return ptIndex.index;
    }

    // ------- Public Functions -------

    /**
     * @notice If liquidation is enabled, verifies if forced liquidation has been
     * reached, checking if globalCoverage <= liquidation
     * @return true if liquidation state is reached, false otherwise
     */
    function isLiquidationReached() public view returns (bool) {
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        uint256 cglb = _getCglb(lckAC, nACgain);
        return cglb <= liqThrld;
    }

    /**
     * @notice return current amount of Tps
     */
    function getTpAmount() external view returns (uint256) {
        return tpTokens.length;
    }

    /**
     * @notice evaluates if liquidation threshold has been reached and liq is Enabled.
     * If so forces contracts liquidation, blocking all mint & redeem operations.
     *
     * May emit a {ContractLiquidated} event.
     */
    function evalLiquidation() public virtual notPaused {
        if (liqEnabled && !liquidated && isLiquidationReached()) {
            liquidated = true;
            emit ContractLiquidated();
            tcToken.pause();
            // Freeze current Peg Price given the AC available
            settleLiquidationPrices();
        }
    }

    /**
     * @notice get how many Pegged Token equal 1 Collateral Asset
     * @param tp_ Pegged Token address
     * @return price [PREC]
     */
    function getPACtp(address tp_) public view virtual returns (uint256) {
        return _getPACtp(_tpi(tp_));
    }

    // ------- Internal Functions -------

    /**
     * @notice get how many Pegged Token equal 1 Collateral Asset
     * @param i_ Pegged Token index
     * @return price [PREC]
     */
    function _getPACtp(uint256 i_) internal view virtual returns (uint256) {
        IPriceProvider priceProvider = pegContainer[i_].priceProvider;
        (uint256 price, bool has) = _peekPrice(priceProvider);
        if (!has) revert MissingProviderPrice(address(priceProvider));
        return price;
    }

    /**
     * @notice ask to a price provider for its token price
     * @dev saves some contract size by using this function instead of calling the external directly
     * @param priceProvider_ Pegged Token index
     * @return price casted to uint256 [PREC]
     * @return has true if has a valid price
     */
    function _peekPrice(IPriceProvider priceProvider_) internal view returns (uint256, bool) {
        (bytes32 price, bool has) = priceProvider_.peek();
        return (uint256(price), has);
    }

    /**
     * @notice gets all TP prices
     * @return pACtps All tps prices [PREC]
     */
    function _getPACtps() internal view returns (uint256[] memory pACtps) {
        uint256 pegAmount = pegContainer.length;
        pACtps = new uint256[](pegAmount);
        for (uint256 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            pACtps[i] = _getPACtp(i);
        }
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @dev sets the fee pct to be retainer on AC fees payments as AC re-injection.
     * @param feeRetainer_  pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setFeeRetainer(uint256 feeRetainer_) external onlyAuthorizedChanger {
        feeRetainer = feeRetainer_;
    }

    /**
     * @dev sets the fee charged on Token Collateral mint.
     * @param tcMintFee_ addition fee pct applied on Collateral Tokens mint [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setTcMintFee(uint256 tcMintFee_) external onlyAuthorizedChanger {
        tcMintFee = tcMintFee_;
    }

    /**
     * @dev sets the fee charged on Token Collateral redeem.
     * @param tcRedeemFee_ addition fee pct applied on Collateral Tokens redeem [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setTcRedeemFee(uint256 tcRedeemFee_) external onlyAuthorizedChanger {
        tcRedeemFee = tcRedeemFee_;
    }

    /**
     * @dev sets the fee charged when swap a Pegged Token for another Pegged Token.
     * @param swapTPforTPFee_ additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setSwapTPforTPFee(uint256 swapTPforTPFee_) external onlyAuthorizedChanger {
        swapTPforTPFee = swapTPforTPFee_;
    }

    /**
     * @dev sets the fee charged when swap a Pegged Token for Collateral Token.
     * @param swapTPforTCFee_ additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setSwapTPforTCFee(uint256 swapTPforTCFee_) external onlyAuthorizedChanger {
        swapTPforTCFee = swapTPforTCFee_;
    }

    /**
     * @dev sets the fee charged when swap Collateral Token for a Pegged Token.
     * @param swapTCforTPFee_ additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setSwapTCforTPFee(uint256 swapTCforTPFee_) external onlyAuthorizedChanger {
        swapTCforTPFee = swapTCforTPFee_;
    }

    /**
     * @dev sets the fee charged when redeem Collateral Token and Pegged Token in one operation.
     * @param redeemTCandTPFee_ additional fee pct applied on redeem Collateral Token and Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setRedeemTCandTPFee(uint256 redeemTCandTPFee_) external onlyAuthorizedChanger {
        redeemTCandTPFee = redeemTCandTPFee_;
    }

    /**
     * @dev sets the fee charged when mint Collateral Token and Pegged Token in one operation.
     * @param mintTCandTPFee_ additional fee pct applied on mint Collateral Token and Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setMintTCandTPFee(uint256 mintTCandTPFee_) external onlyAuthorizedChanger {
        mintTCandTPFee = mintTCandTPFee_;
    }

    /**
     * @dev sets the fee applied on the top of the operation`s fee when using Fee Token as fee payment method.
     * @param feeTokenPct_ pct applied on the top of the operation`s fee when using Fee Token
     *  as fee payment method [PREC]
     *  e.g. if tcMintFee = 1%, FeeTokenPct = 50% => qFeeToken = 0.5%
     *  0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setFeeTokenPct(uint256 feeTokenPct_) external onlyAuthorizedChanger {
        feeTokenPct = feeTokenPct_;
    }

    /**
     * @dev sets Moc Fee Flow contract address
     * @param mocFeeFlowAddress_ moc Fee Flow new contract address
     */
    function setMocFeeFlowAddress(address mocFeeFlowAddress_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        mocFeeFlowAddress = mocFeeFlowAddress_;
    }

    /**
     * @dev sets Moc Appreciation Beneficiary Address
     * @param mocAppreciationBeneficiaryAddress_ moc Appreciation Beneficiary new address
     */
    function setMocAppreciationBeneficiaryAddress(
        address mocAppreciationBeneficiaryAddress_
    ) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        mocAppreciationBeneficiaryAddress = mocAppreciationBeneficiaryAddress_;
    }

    /**
     * @dev sets Fee Token contract address
     * @param mocFeeTokenAddress_ Fee Token new contract address
     */
    function setFeeTokenAddress(address mocFeeTokenAddress_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        feeToken = IERC20(mocFeeTokenAddress_);
    }

    /**
     * @dev sets Fee Token price provider contract address
     * @param mocFeeTokenPriceProviderAddress_ Fee Token price provider new contract address
     */
    function setFeeTokenPriceProviderAddress(address mocFeeTokenPriceProviderAddress_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        feeTokenPriceProvider = IPriceProvider(mocFeeTokenPriceProviderAddress_);
    }

    /**
     * @dev sets the value of the protected threshold configuration param
     * @param protThrld_ coverage protected state threshold [PREC]
     */
    function setProtThrld(uint256 protThrld_) external onlyAuthorizedChanger {
        protThrld = protThrld_;
    }

    /**
     * @dev sets the value of the liq threshold configuration param
     * @param liqThrld_ liquidation threshold
     */
    function setLiqThrld(uint256 liqThrld_) external onlyAuthorizedChanger {
        liqThrld = liqThrld_;
    }

    /**
     * @dev enables and disables the liquidation mechanism.
     * @param liqEnabled_ is liquidation enabled
     */
    function setLiqEnabled(bool liqEnabled_) external onlyAuthorizedChanger {
        liqEnabled = liqEnabled_;
    }

    /**
     * @dev sets success Fee value.
     * @param successFee_ pct of the gain because Pegged Tokens devaluation that is
     * transferred in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     */
    function setSuccessFee(uint256 successFee_) external onlyAuthorizedChanger {
        successFee = successFee_;
    }

    /**
     * @dev sets appreciation Factor value.
     * @param appreciationFactor_ pct of the gain because Pegged Tokens devaluation that is returned
     * in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
     */
    function setAppreciationFactor(uint256 appreciationFactor_) external onlyAuthorizedChanger {
        appreciationFactor = appreciationFactor_;
    }

    /**
     * @dev sets TC interest collector address
     * @param tcInterestCollectorAddress_ TC interest collector address
     */
    function setTCInterestCollectorAddress(address tcInterestCollectorAddress_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        tcInterestCollectorAddress = tcInterestCollectorAddress_;
    }

    /**
     * @dev sets TC interest rate
     * @param tcInterestRate_ pct interest charged to TC holders on the total collateral in the protocol [PREC]
     */
    function setTCInterestRate(uint256 tcInterestRate_) external onlyAuthorizedChanger {
        tcInterestRate = tcInterestRate_;
    }

    /**
     * @dev sets TC interest payment block span
     * @param tcInterestPaymentBlockSpan_ amount of blocks to wait for next TC interest payment
     * @dev nextTCInterestPayment is not automatically updated, you have to wait until next
     *  interest payment to be made : nextTCInterestPayment = block.number + tcInterestPaymentBlockSpan
     */
    function setTCInterestPaymentBlockSpan(uint256 tcInterestPaymentBlockSpan_) external onlyAuthorizedChanger {
        tcInterestPaymentBlockSpan = tcInterestPaymentBlockSpan_;
    }

    /**
     * @param bes_ number of blocks between settlements
     * @dev bns is not automatically updated, you have to wait until next
     * settlement to be made : bns = block.number + bes
     **/
    function setBes(uint256 bes_) external onlyAuthorizedChanger {
        bes = bes_;
    }

    /**
     * @dev sets max absolute operation provider address
     * @param maxAbsoluteOpProviderAddress_ max absolute operation provider address
     */
    function setMaxAbsoluteOpProviderAddress(address maxAbsoluteOpProviderAddress_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        maxAbsoluteOpProvider = IDataProvider(maxAbsoluteOpProviderAddress_);
    }

    /**
     * @dev sets max operation difference provider address
     * @param maxOpDiffProviderAddress_ max operation difference provider address
     */
    function setMaxOpDiffProviderAddress(address maxOpDiffProviderAddress_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        maxOpDiffProvider = IDataProvider(maxOpDiffProviderAddress_);
    }

    /**
     * @dev sets flux capacitor decay block span
     * @param decayBlockSpan_ flux capacitor decay block span
     */
    function setDecayBlockSpan(uint256 decayBlockSpan_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        decayBlockSpan = decayBlockSpan_;
    }

    /**
     * @dev sets Moc Queue contract address
     * @param mocQueueAddress_ moc queue new contract address
     */
    function setMocQueue(address payable mocQueueAddress_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        mocQueue = mocQueueAddress_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */

    // Purposely left unused to save some state space to allow for future upgrades
    // slither-disable-next-line unused-state
    uint256[50] private __gap;
}
