// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../tokens/MocRC20.sol";
import "../interfaces/IMocRC20.sol";
import "./MocBaseBucket.sol";
import "./MocEma.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title MocCore
 * @notice MocCore nucleats all the basic MoC functionality and toolset. It allows Collateral
 * asset aware contracts to implement the main mint/redeem operations.
 */
abstract contract MocCore is MocBaseBucket, MocEma, Pausable, Initializable {
    // ------- Custom Errors -------
    error LowCoverage(uint256 getCglb_, uint256 protThrld_);
    error InsufficientQacSent(uint256 _qACsent, uint256 _qACNedeed_);

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @dev this function must be execute by the AC implementation at initialization
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model
     * @param protThrld_ protected state threshold
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens
     */
    function _MocCore_init(
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) internal onlyInitializing {
        if (tcTokenAddress_ == address(0)) revert InvalidAddress();
        if (mocFeeFlowAddress_ == address(0)) revert InvalidAddress();
        if (tcMintFee_ > PRECISION) revert InvalidValue();
        if (tcRedeemFee_ > PRECISION) revert InvalidValue();
        tcToken = IMocRC20(tcTokenAddress_);
        mocFeeFlowAddress = mocFeeFlowAddress_;
        ctarg = ctarg_;
        protThrld = protThrld_;
        tcMintFee = tcMintFee_;
        tcRedeemFee = tcRedeemFee_;
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
     * @param sender_ address who sends the Collateral Asset
     * @param recipient_ address who receives the Collateral Token
     */
    function _mintTCto(
        uint256 qTC_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal {
        // calculate how many qAC are nedeed to mint TC and the qAC fee
        (uint256 qACNedeedtoMint, uint256 qACfee) = calcQACforMintTC(qTC_, qACmax_);
        // add qTC and qAC to the Bucket
        _depositTC(qTC_, qACNedeedtoMint);
        // mint qTC to the recipient
        tcToken.mint(recipient_, qTC_);
        // calculate how many qAC should be returned to the sender
        uint256 qACchg = qACmax_ - qACNedeedtoMint - qACfee;
        // transfer qAC to the sender
        acTransfer(sender_, qACchg);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
    }

    // ------- Public Functions -------

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Collateral Token
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return qACNedeedtoMint amount of Collateral Asset nedeed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function calcQACforMintTC(uint256 qTC_, uint256 qACmax_)
        public
        view
        returns (uint256 qACNedeedtoMint, uint256 qACfee)
    {
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

        uint256 qACtotalNedeed = qACNedeedtoMint + qACfee;
        if (qACtotalNedeed > qACmax_) revert InsufficientQacSent(qACtotalNedeed, qACmax_);
        return (qACNedeedtoMint, qACfee);
    }
}
