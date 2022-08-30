pragma solidity ^0.8.16;
import "../rc20/MocCARC20.sol";
import "./MocCAWrapper.sol";

contract MocCABag is MocCARC20 {
    MocCAWrapper private mocCAWrapper;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param mocCAWrapperAddress_ Moc Collateral Asset Wrapper contract address
     * @param acTokenAddress_ Collateral Asset Token contract address
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model [PREC]
     * @param protThrld_ protected state threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     */
    function initialize(
        address mocCAWrapperAddress_,
        address acTokenAddress_,
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) external initializer {
        if (mocCAWrapperAddress_ == address(0)) revert InvalidAddress();
        if (acTokenAddress_ == address(0)) revert InvalidAddress();
        mocCAWrapper = MocCAWrapper(mocCAWrapperAddress_);
        acToken = MocRC20(acTokenAddress_);
        _MocCore_init(tcTokenAddress_, mocFeeFlowAddress_, ctarg_, protThrld_, tcMintFee_, tcRedeemFee_);
    }

    function _getPTPac(uint8 i_) internal view override returns (uint256) {
        uint256 tpPrice = super._getPTPac(i_);
        uint256 wcaTokenPrice = mocCAWrapper.getTokenPrice();
        // [PREC] = [PREC] * [PREC] / [PREC]
        return (tpPrice * PRECISION) / wcaTokenPrice;
    }
}
