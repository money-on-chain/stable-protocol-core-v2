pragma solidity ^0.8.16;

import "../tokens/MocRC20.sol";
import "../interfaces/IMocRC20.sol";
import "./MocEma.sol";

/**
 * @title MocCore
 * @notice MocCore nucleats all the basic MoC functionality and toolset. It allows Collateral
 * asset aware contracts to implement the main mint/redeem operations.
 */
abstract contract MocCore is MocEma {
    // ------- Events -------
    event TCMinted(address indexed sender_, address indexed recipient_, uint256 qTC_, uint256 qAC_);
    event PeggedTokenAdded(
        address indexed tpTokenAddress_,
        address priceProviderAddress_,
        uint256 tpR_,
        uint256 tpBmin_,
        uint256 tpMintFee_,
        uint256 tpRedeemFee_
    );
    // ------- Custom Errors -------
    error LowCoverage(uint256 cglb_, uint256 protThrld_);
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNedeed_);

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @dev this function must be execute by the AC implementation at initialization
     * @param governor_ The address that will define when a change contract is authorized
     * @param stopper_ The address that is authorized to pause this contract
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model [PREC]
     * @param protThrld_ protected state threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     */
    function __MocCore_init(
        IGovernor governor_,
        address stopper_,
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) internal onlyInitializing {
        __MocUpgradable_init(governor_, stopper_);
        __MocBaseBucket_init_unchained(
            tcTokenAddress_,
            mocFeeFlowAddress_,
            ctarg_,
            protThrld_,
            tcMintFee_,
            tcRedeemFee_
        );
        __MocEma_init_unchained();
    }

    // ------- Internal Functions -------

    /**
     * @notice transfer Collateral Asset
     * @dev this function must be overriden by the AC implementation
     * @param to_ address who receives the Collateral Asset
     * @param amount_ amount of Collateral Asset to transfer
     */
    function acTransfer(address to_, uint256 amount_) internal virtual;

    /**
     * @notice mint Collateral Token in exchange for Collateral Asset
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param sender_ address who sends the Collateral Asset, all unspent amount is returned to it
     * @param recipient_ address who receives the Collateral Token
     */
    function _mintTCto(
        uint256 qTC_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal {
        // calculate how many qAC are nedeed to mint TC and the qAC fee
        (uint256 qACNedeedtoMint, uint256 qACfee) = calcQACforMintTC(qTC_);
        uint256 qACtotalNedeed = qACNedeedtoMint + qACfee;
        if (qACtotalNedeed > qACmax_) revert InsufficientQacSent(qACtotalNedeed, qACmax_);
        // add qTC and qAC to the Bucket
        _depositTC(qTC_, qACNedeedtoMint);
        // mint qTC to the recipient
        tcToken.mint(recipient_, qTC_);
        // calculate how many qAC should be returned to the sender
        uint256 qACchg = qACmax_ - qACtotalNedeed;
        // transfer qAC to the sender
        acTransfer(sender_, qACchg);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        emit TCMinted(sender_, recipient_, qTC_, qACtotalNedeed);
    }

    // ------- Public Functions -------

    /**
     * @notice add a Pegged Token to the protocol
     * TODO: this function should be called only through governance system
     * @param tpTokenAddress_ Pegged Token contract address to add
     * @param priceProviderAddress_ Pegged Token price provider contract address
     * @param tpR_ Pegged Token reserve factor [PREC]
     * @param tpBmin_ Pegged Token minimum amount of blocks until the settlement to charge interest for redeem [N]
     * @param tpMintFee_ fee pct sent to Fee Flow for mint [PREC]
     * @param tpRedeemFee_ fee pct sent to Fee Flow for redeem [PREC]
     */
    function addPeggedToken(
        address tpTokenAddress_,
        address priceProviderAddress_,
        uint256 tpR_,
        uint256 tpBmin_,
        uint256 tpMintFee_,
        uint256 tpRedeemFee_
    ) public {
        if (tpTokenAddress_ == address(0)) revert InvalidAddress();
        if (priceProviderAddress_ == address(0)) revert InvalidAddress();
        if (tpMintFee_ > PRECISION) revert InvalidValue();
        if (tpRedeemFee_ > PRECISION) revert InvalidValue();
        // set Pegged Token address
        tpToken.push(IMocRC20(tpTokenAddress_));
        // set peg container item
        pegContainer.push(PegContainerItem({ nTP: 0, nTPXV: 0, priceProvider: IPriceProvider(priceProviderAddress_) }));
        // set reserve factor
        tpR.push(tpR_);
        // set minimum amount of blocks
        tpBmin.push(tpBmin_);
        // set mint fee pct
        tpMintFee.push(tpMintFee_);
        // set redeem fee pct
        tpRedeemFee.push(tpRedeemFee_);
        emit PeggedTokenAdded(tpTokenAddress_, priceProviderAddress_, tpR_, tpBmin_, tpMintFee_, tpRedeemFee_);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Collateral Token
     * @param qTC_ amount of Collateral Token to mint
     * @return qACNedeedtoMint amount of Collateral Asset nedeed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function calcQACforMintTC(uint256 qTC_) public view returns (uint256 qACNedeedtoMint, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        uint256 lckAC = getLckAC();
        uint256 cglb = getCglb(lckAC);
        // check coverage is above the protected threshold
        if (cglb <= protThrld) revert LowCoverage(cglb, protThrld);
        // calculate how many qAC are nedeed to mint TC
        // [N] = [N] * [PREC] / [PREC]
        qACNedeedtoMint = (qTC_ * getPTCac(lckAC)) / PRECISION;
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = (qACNedeedtoMint * tcMintFee) / PRECISION;

        return (qACNedeedtoMint, qACfee);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
