// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import { MocCARC20, IERC20, SafeERC20 } from "../rc20/MocCARC20.sol";
import { IMocRC20, IERC20Upgradeable } from "../../interfaces/IMocRC20.sol";
import { IPriceProvider } from "../../interfaces/IPriceProvider.sol";
import { MocUpgradable } from "../../governance/MocUpgradable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
/* solhint-disable-next-line max-line-length */
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/**
 * @title MocCAWrapper: Moc Collateral Asset Wrapper
 * @notice Wraps a collection of ERC20 stablecoins to a token which is used as Collateral Asset by
 *  Moc Collateral Asset Bag protocol implementation
 */
contract MocCAWrapper is MocUpgradable, ReentrancyGuardUpgradeable {
    // ------- Events -------
    event TCMintedWithWrapper(
        address asset_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAsset_
    );
    event TCRedeemedWithWrapper(
        address asset_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAsset_
    );
    event TPMintedWithWrapper(
        address asset_,
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event TPRedeemedWithWrapper(
        address asset_,
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event TCandTPMintedWithWrapper(
        address asset_,
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event TCandTPRedeemedWithWrapper(
        address asset_,
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event TPSwappedForTPWithWrapper(
        address asset_,
        uint256 indexed iFrom_,
        uint256 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTCto_,
        uint256 qAsset_
    );
    event TPSwappedForTCWithWrapper(
        address asset_,
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qTC_,
        uint256 qAsset_
    );
    event TCSwappedForTPWithWrapper(
        address asset_,
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event AssetModified(address indexed assetAddress_, address priceProviderAddress);

    // ------- Custom Errors -------
    error MissingProviderPrice(address priceProviderAddress_);
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    error InsufficientFeeTokenSent(uint256 qFeeTokenSent_, uint256 qFeeTokenNeeded_);

    // ------- Structs -------
    struct AssetIndex {
        // asset index
        uint256 index;
        // true if asset token exists
        bool exists;
        // how many decimals differs from 18. Eg: if decimals are 6, shift is 12
        int8 shift;
    }

    // ------- Storage -------

    // Wrapped Collateral Asset token
    IMocRC20 internal wcaToken;
    // Moc Core protocol
    MocCARC20 internal mocCore;
    // array of valid assets in the bag
    IERC20[] internal assets;
    // asset -> priceProvider
    mapping(address => IPriceProvider) internal priceProviderMap;
    // asset indexes
    mapping(address => AssetIndex) internal assetIndex;

    // ------- Modifiers -------
    modifier validAsset(address assetAddress_) {
        if (!_isValidAsset(assetAddress_)) revert InvalidAddress();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param governorAddress_ The address that will define when a change contract is authorized
     * @param pauserAddress_ The address that is authorized to pause this contract
     * @param mocCoreAddress_ Moc Core contract address
     * @param wcaTokenAddress_ Wrapped Collateral Asset Token contract address
     */
    function initialize(
        address governorAddress_,
        address pauserAddress_,
        address mocCoreAddress_,
        address wcaTokenAddress_
    ) external initializer {
        __MocUpgradable_init(governorAddress_, pauserAddress_);
        mocCore = MocCARC20(mocCoreAddress_);
        wcaToken = IMocRC20(wcaTokenAddress_);
        // infinite allowance to Moc Core
        SafeERC20Upgradeable.safeApprove(wcaToken, mocCoreAddress_, UINT256_MAX);
    }

    // ------- Internal Functions -------

    /**
     * @notice check if the asset is whitelisted
     * @param assetAddress_ Asset contract address
     * @return true if it is valid
     */
    function _isValidAsset(address assetAddress_) internal view returns (bool) {
        return assetIndex[assetAddress_].exists;
    }

    /**
     * @notice get Asset price
     * @param assetAddress_ Asset contract address
     * @return price [PREC]
     */
    function _getAssetPrice(address assetAddress_) internal view returns (uint256) {
        (bytes32 price, bool has) = priceProviderMap[assetAddress_].peek();
        if (!has) revert MissingProviderPrice(address(priceProviderMap[assetAddress_]));
        return uint256(price);
    }

    /**
     * @notice given an amount of Asset, calculates the equivalent value in wrapped tokens
     * @param assetAddress_ Asset contract address
     * @param assetAmount_ amount of Asset to wrap
     * @return wcaTokenAmount amount of wcaToken [N]
     */
    function _convertAssetToToken(
        address assetAddress_,
        uint256 assetAmount_
    ) internal view returns (uint256 wcaTokenAmount) {
        // get the wrapped token price = totalCurrency / wcaTokenTotalSupply
        // [PREC]
        uint256 wcaTokenPrice = getTokenPrice();
        // calculate how much currency will increment the pool
        // [PREC] = [N] * [PREC]
        uint256 currencyToAdd = assetAmount_ * _getAssetPrice(assetAddress_);
        // divide by wrapped token price to get the equivalent amount of tokens
        // [N] = [PREC] / [PREC]
        return currencyToAdd / wcaTokenPrice;
    }

    /**
     * @notice given an amount of wrapped tokens, calculates the equivalent value in the given asset
     * @param assetAddress_ Asset contract address
     * @param wcaTokenAmount_ amount of wrapped tokens
     * @return assetAmount amount of Asset needed to wrap or unwrap the desired amount of wcaToken [N]
     */
    function _convertTokenToAsset(
        address assetAddress_,
        uint256 wcaTokenAmount_
    ) internal view returns (uint256 assetAmount, uint256 wcaTokenAmount) {
        // get the wrapped token price = totalCurrency / wcaTokenTotalSupply
        // [PREC]
        uint256 wcaTokenPrice = getTokenPrice();
        // multiply by wcaTokenAmount_ to get how many currency we need
        // [PREC] = [PREC] * [N]
        uint256 currencyNeeded = wcaTokenPrice * wcaTokenAmount_;
        // divide currencyNeeded by asset price to get how many assets we need
        // [N] = [PREC] / [PREC]
        assetAmount = currencyNeeded / _getAssetPrice(assetAddress_);
        // truncate wcaToken amount to align decimal places and avoid rounding error
        wcaTokenAmount_ = _truncate(assetAddress_, wcaTokenAmount_);
        return (assetAmount, wcaTokenAmount_);
    }

    /**
     * @notice truncate amount of decimals corresponding to the Asset shift value
     * @dev this is necessary to avoid rounding errors when dealing with Assets with decimal places less than 18
     *  Eg: Asset decimals = 6; value = 10999999 => truncated = 10999900
     * @param assetAddress_ Asset contract address
     * @param value_ number to truncate
     * @return truncated value truncated
     */
    function _truncate(address assetAddress_, uint256 value_) internal view returns (uint256 truncated) {
        int8 shift = assetIndex[assetAddress_].shift;
        truncated = value_;
        if (shift > 0) {
            // slither-disable-next-line divide-before-multiply
            truncated /= 10 ** uint8(shift);
            truncated *= 10 ** uint8(shift);
        }
        return truncated;
    }

    /**
     * @notice transfer Fee Tokens from the `sender_` to this contract
     * @param sender_ address who executes the operation
     * @return feeToken Fee Token contract
     * @return qFeeTokenAvailable minimum between the `sender_` Fee Token balance and allowance
     */
    function _transferFeeTokenFromSender(
        address sender_
    ) internal returns (IERC20 feeToken, uint256 qFeeTokenAvailable) {
        feeToken = mocCore.feeToken();
        qFeeTokenAvailable = Math.min(feeToken.allowance(sender_, address(this)), feeToken.balanceOf(sender_));
        if (qFeeTokenAvailable > 0) {
            SafeERC20.safeTransferFrom(feeToken, sender_, address(this), qFeeTokenAvailable);
            SafeERC20.safeApprove(feeToken, address(mocCore), qFeeTokenAvailable);
        }
        return (feeToken, qFeeTokenAvailable);
    }

    /**
     * @notice transfer Fee Tokens from this contract to the `sender_`
     * @param feeToken_ Fee Token contract
     * @param sender_ address who executes the operation
     * @param qFeeTokenAvailable_ amount of Fee Token that the `sender_` has transferred to spend
     * @param qFeeTokenSpent_ amount of Fee Token spent by MocCore as fee payment method
     */
    function _transferFeeTokenToSender(
        IERC20 feeToken_,
        address sender_,
        uint256 qFeeTokenAvailable_,
        uint256 qFeeTokenSpent_
    ) internal {
        uint256 qFeeTokenChange = qFeeTokenAvailable_ - qFeeTokenSpent_;
        if (qFeeTokenChange > 0) {
            SafeERC20.safeTransfer(feeToken_, sender_, qFeeTokenChange);
            // if doesn't use all, we have to reset the allowance
            SafeERC20.safeApprove(feeToken_, address(mocCore), 0);
        }
    }

    struct MintTCParams {
        address assetAddress;
        uint256 qTC;
        uint256 qAssetMax;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param params_ mint TC function params
     * @dev
     *      assetAddress_ Asset contract address
     *      qTC_ amount of Collateral Token to mint
     *      qAssetMax_ maximum amount of Asset that can be spent
     *      sender_ address who sends the Asset
     *      recipient_ address who receives the Collateral Token
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _mintTCto(MintTCParams memory params_) internal validAsset(params_.assetAddress) {
        uint256 wcaMinted = _wrapTo(params_.assetAddress, params_.qAssetMax, params_.sender, address(this));
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        // mint TC to the recipient
        (uint256 wcaUsed, uint256 qFeeTokenUsed) = mocCore.mintTCtoViaVendor(
            params_.qTC,
            wcaMinted,
            params_.recipient,
            params_.vendor
        );
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapTo(params_.assetAddress, wcaUnused, 0, address(this), params_.sender);
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        emit TCMintedWithWrapper(
            params_.assetAddress,
            params_.sender,
            params_.recipient,
            params_.qTC,
            params_.qAssetMax - assetUnused
        );
    }

    struct RedeemTCParams {
        address assetAddress;
        uint256 qTC;
        uint256 qAssetMin;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Assets
     *  Requires prior sender approval of Collateral Token to this contract
     * @param params_ redeem TC function params
     * @dev
     *      assetAddress_ Asset contract address
     *      qTC_ amount of Collateral Token to redeem
     *      qAssetMin_ minimum expected Asset amount to be received
     *      sender_ address who sends the Collateral Token
     *      recipient_ address who receives the Asset
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _redeemTCto(RedeemTCParams memory params_) internal validAsset(params_.assetAddress) {
        // get Collateral Token contract address
        IERC20Upgradeable tcToken = mocCore.tcToken();
        // transfer Collateral Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tcToken, params_.sender, address(this), params_.qTC);
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        // redeem Collateral Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' to qACmin parameter to do not revert by qAC below minimum since we are
        // checking it after with qAssetMin
        (uint256 wcaTokenAmountRedeemed, uint256 qFeeTokenUsed) = mocCore.redeemTCViaVendor(
            params_.qTC,
            0,
            params_.vendor
        );
        // send Asset to the recipient
        uint256 assetRedeemed = _unwrapTo(
            params_.assetAddress,
            wcaTokenAmountRedeemed,
            params_.qAssetMin,
            address(this),
            params_.recipient
        );
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        emit TCRedeemedWithWrapper(params_.assetAddress, params_.sender, params_.recipient, params_.qTC, assetRedeemed);
    }

    struct MintTPParams {
        address assetAddress;
        uint256 i;
        uint256 qTP;
        uint256 qAssetMax;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
     *  Requires prior sender approval of Asset to this contract
     * @param params_ mint TP function params
     * @dev
     *      assetAddress_ Asset contract address
     *      i_ Pegged Token index
     *      qTP_ amount of Collateral Token to mint
     *      qAssetMax_ maximum amount of Asset that can be spent
     *      sender_ address who sends the Asset
     *      recipient_ address who receives the Collateral Token
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _mintTPto(MintTPParams memory params_) internal validAsset(params_.assetAddress) {
        uint256 wcaMinted = _wrapTo(params_.assetAddress, params_.qAssetMax, params_.sender, address(this));
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        // mint TP to the recipient
        (uint256 wcaUsed, uint256 qFeeTokenUsed) = mocCore.mintTPtoViaVendor(
            params_.i,
            params_.qTP,
            wcaMinted,
            params_.recipient,
            params_.vendor
        );
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapTo(params_.assetAddress, wcaUnused, 0, address(this), params_.sender);
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        emit TPMintedWithWrapper(
            params_.assetAddress,
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            params_.qAssetMax - assetUnused
        );
    }

    struct RedeemTPParams {
        address assetAddress;
        uint256 i;
        uint256 qTP;
        uint256 qAssetMin;
        address sender;
        address recipient;
        address vendor;
        bool isLiqRedeem;
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Assets
     *  Requires prior sender approval of Pegged Token to this contract
     * @param params_ redeem TP function params
     * @dev
     *      assetAddress_ Asset contract address
     *      i_ Pegged Token index
     *      qTP_ amount of Pegged Token to redeem
     *      qAssetMin_ minimum expected Asset amount to be received
     *      sender_ address who sends the Pegged Token
     *      recipient_ address who receives the Asset
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _redeemTPto(RedeemTPParams memory params_) internal validAsset(params_.assetAddress) {
        // get Pegged Token contract address
        IERC20Upgradeable tpToken = mocCore.tpTokens(params_.i);
        // When liquidating, we extract all the user's balance
        if (params_.isLiqRedeem) params_.qTP = tpToken.balanceOf(params_.sender);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpToken, params_.sender, address(this), params_.qTP);
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        // redeem Pegged Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' to qACmin parameter to do not revert by qAC below minimum since we are
        // checking it after with qAssetMin
        uint256 wcaTokenAmountRedeemed = 0;
        uint256 qFeeTokenUsed = 0;
        if (params_.isLiqRedeem) wcaTokenAmountRedeemed = mocCore.liqRedeemTP(params_.i);
        else
            (wcaTokenAmountRedeemed, qFeeTokenUsed) = mocCore.redeemTPViaVendor(
                params_.i,
                params_.qTP,
                0,
                params_.vendor
            );
        // send Asset to the recipient
        uint256 assetRedeemed = _unwrapTo(
            params_.assetAddress,
            wcaTokenAmountRedeemed,
            params_.qAssetMin,
            address(this),
            params_.recipient
        );
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        emit TPRedeemedWithWrapper(
            params_.assetAddress,
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            assetRedeemed
        );
    }

    struct MintTCandTPParams {
        address assetAddress;
        uint256 i;
        uint256 qTP;
        uint256 qAssetMax;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token and Pegged Token
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param params_ mint TC and TP function params
     * @dev
     *      assetAddress_ Asset contract address
     *      i_ Pegged Token index
     *      qTP_ amount of Pegged Token to mint
     *      qAssetMax_ maximum amount of Asset that can be spent
     *      recipient_ address who receives the Collateral Token and Pegged Token
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _mintTCandTPto(MintTCandTPParams memory params_) internal validAsset(params_.assetAddress) {
        uint256 wcaMinted = _wrapTo(params_.assetAddress, params_.qAssetMax, params_.sender, address(this));
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        // mint TC and TP to the recipient
        (uint256 wcaUsed, uint256 qTCminted, uint256 qFeeTokenUsed) = mocCore.mintTCandTPtoViaVendor(
            params_.i,
            params_.qTP,
            wcaMinted,
            params_.recipient,
            params_.vendor
        );
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapTo(params_.assetAddress, wcaMinted - wcaUsed, 0, address(this), params_.sender);
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        // inside a block to avoid stack too deep error
        {
            MintTCandTPParams memory params = params_;
            emit TCandTPMintedWithWrapper(
                params.assetAddress,
                params.i,
                params.sender,
                params.recipient,
                qTCminted,
                params.qTP,
                params.qAssetMax - assetUnused
            );
        }
    }

    struct RedeemTCandTPParams {
        address assetAddress;
        uint256 i;
        uint256 qTC;
        uint256 qTP;
        uint256 qAssetMin;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives Assets
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param params_ redeem TC and TP function params
     * @dev
     *      assetAddress_ Asset contract address
     *      i_ Pegged Token index
     *      qTC_ maximum amount of Collateral Token to redeem
     *      qTP_ maximum amount of Pegged Token to redeem
     *      qAssetMin_ minimum amount of Asset that expect to be received
     *      sender_ address who sends Collateral Token and Pegged Token
     *      recipient_ address who receives the Asset
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _redeemTCandTPto(RedeemTCandTPParams memory params_) internal validAsset(params_.assetAddress) {
        // get Collateral Token contract address
        IERC20Upgradeable tcToken = mocCore.tcToken();
        // get Pegged Token contract address
        IERC20Upgradeable tpToken = mocCore.tpTokens(params_.i);
        // transfer Collateral Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tcToken, params_.sender, address(this), params_.qTC);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpToken, params_.sender, address(this), params_.qTP);
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        // redeem Collateral Token and Pegged Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' as qACmin parameter to avoid reverting by qAC below minimum since we are
        // checking it after with qAssetMin
        (uint256 wcaTokenAmountRedeemed, uint256 qTPRedeemed, uint256 qFeeTokenUsed) = mocCore.redeemTCandTPViaVendor(
            params_.i,
            params_.qTC,
            params_.qTP,
            0,
            params_.vendor
        );
        // send Asset to the recipient
        uint256 assetRedeemed = _unwrapTo(
            params_.assetAddress,
            wcaTokenAmountRedeemed,
            params_.qAssetMin,
            address(this),
            params_.recipient
        );
        // transfer unused Pegged Token to the sender
        SafeERC20Upgradeable.safeTransfer(tpToken, params_.sender, params_.qTP - qTPRedeemed);
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        emit TCandTPRedeemedWithWrapper(
            params_.assetAddress,
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTC,
            qTPRedeemed,
            assetRedeemed
        );
    }

    struct SwapTPforTPParams {
        address assetAddress;
        uint256 iFrom;
        uint256 iTo;
        uint256 qTP;
        uint256 qTPmin;
        uint256 qAssetMax;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param params_ swap TP for TP function params
     * @dev
     *      assetAddress_ Asset contract address
     *      iFrom_ owned Pegged Token index
     *      iTo_ target Pegged Token index
     *      qTP_ amount of owned Pegged Token to swap
     *      qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     *      qAssetMax_ maximum amount of Asset that can be spent in fees
     *      sender_ address who sends the Pegged Token
     *      recipient_ address who receives the target Pegged Token
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _swapTPforTPto(SwapTPforTPParams memory params_) internal validAsset(params_.assetAddress) {
        uint256 wcaMinted = _wrapTo(params_.assetAddress, params_.qAssetMax, params_.sender, address(this));
        // get Pegged Token contract address
        IERC20Upgradeable tpTokenFrom = mocCore.tpTokens(params_.iFrom);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpTokenFrom, params_.sender, address(this), params_.qTP);
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        // inside a block to avoid stack too deep error
        {
            SwapTPforTPParams memory params = params_;
            (uint256 wcaUsed, uint256 qTPMinted, uint256 qFeeTokenUsed) = mocCore.swapTPforTPtoViaVendor(
                params.iFrom,
                params.iTo,
                params.qTP,
                params.qTPmin,
                wcaMinted,
                params.recipient,
                params.vendor
            );
            // send back Asset unused to the sender
            // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
            // that can be spent
            uint256 assetUnused = _unwrapTo(params.assetAddress, wcaMinted - wcaUsed, 0, address(this), params.sender);
            // transfer back the unused Fee Token
            _transferFeeTokenToSender(feeToken, params.sender, qFeeTokenAvailable, qFeeTokenUsed);
            emit TPSwappedForTPWithWrapper(
                params.assetAddress,
                params.iFrom,
                params.iTo,
                params.sender,
                params.recipient,
                params.qTP,
                qTPMinted,
                params.qAssetMax - assetUnused
            );
        }
    }

    struct SwapTPforTCParams {
        address assetAddress;
        uint256 i;
        uint256 qTP;
        uint256 qTCmin;
        uint256 qAssetMax;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param params_ swap TP for TC function params
     * @dev
     *      assetAddress_ Asset contract address
     *      i_ owned Pegged Token index
     *      qTP_ amount of owned Pegged Token to swap
     *      qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     *      qAssetMax_ maximum amount of Asset that can be spent in fees
     *      sender_ address who sends the Pegged Token
     *      recipient_ address who receives the Collateral Token
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _swapTPforTCto(SwapTPforTCParams memory params_) internal validAsset(params_.assetAddress) {
        uint256 wcaMinted = _wrapTo(params_.assetAddress, params_.qAssetMax, params_.sender, address(this));
        // get Pegged Token contract address
        IERC20Upgradeable tpToken = mocCore.tpTokens(params_.i);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpToken, params_.sender, address(this), params_.qTP);
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        (uint256 wcaUsed, uint256 qTCMinted, uint256 qFeeTokenUsed) = mocCore.swapTPforTCtoViaVendor(
            params_.i,
            params_.qTP,
            params_.qTCmin,
            wcaMinted,
            params_.recipient,
            params_.vendor
        );
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapTo(params_.assetAddress, wcaMinted - wcaUsed, 0, address(this), params_.sender);
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        // inside a block to avoid stack too deep error
        {
            SwapTPforTCParams memory params = params_;
            emit TPSwappedForTCWithWrapper(
                params.assetAddress,
                params.i,
                params.sender,
                params.recipient,
                params.qTP,
                qTCMinted,
                params.qAssetMax - assetUnused
            );
        }
    }

    struct SwapTCforTPParams {
        address assetAddress;
        uint256 i;
        uint256 qTC;
        uint256 qTPmin;
        uint256 qAssetMax;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice caller sends a Collateral Token and recipient receives Pegged Token
     *  Requires prior sender approval of Collateral Token and Asset to this contract
     * @param params_ swap TC for TP function params
     * @dev
     *      assetAddress_ Asset contract address
     *      i_ Pegged Token index
     *      qTC_ amount of Collateral Token to swap
     *      qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     *      qAssetMax_ maximum amount of Asset that can be spent in fees
     *      sender_ address who sends the Collateral Token
     *      recipient_ address who receives the Pegged Token
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     */

    function _swapTCforTPto(SwapTCforTPParams memory params_) internal validAsset(params_.assetAddress) {
        uint256 wcaMinted = _wrapTo(params_.assetAddress, params_.qAssetMax, params_.sender, address(this));
        // get Collateral Token contract address
        IERC20Upgradeable tcToken = mocCore.tcToken();
        // transfer Collateral Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tcToken, params_.sender, address(this), params_.qTC);
        // if sender has Fee Token balance and allowance, we transfer them to be used as fee payment method
        (IERC20 feeToken, uint256 qFeeTokenAvailable) = _transferFeeTokenFromSender(params_.sender);
        (uint256 wcaUsed, uint256 qTPMinted, uint256 qFeeTokenUsed) = mocCore.swapTCforTPtoViaVendor(
            params_.i,
            params_.qTC,
            params_.qTPmin,
            wcaMinted,
            params_.recipient,
            params_.vendor
        );
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapTo(params_.assetAddress, wcaMinted - wcaUsed, 0, address(this), params_.sender);
        // transfer back the unused Fee Token
        _transferFeeTokenToSender(feeToken, params_.sender, qFeeTokenAvailable, qFeeTokenUsed);
        // inside a block to avoid stack too deep error
        {
            SwapTCforTPParams memory params = params_;
            emit TCSwappedForTPWithWrapper(
                params.assetAddress,
                params.i,
                params.sender,
                params.recipient,
                params.qTC,
                qTPMinted,
                params.qAssetMax - assetUnused
            );
        }
    }

    /**
     * @notice caller sends Asset and recipient receives Wrapped Collateral Asset
     *  Requires prior sender approval of Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param qAsset_ amount of Asset to be Wrapped
     * @param sender_ address who sends the Asset
     * @param recipient_ address who receives the Wrapped Collateral Asset
     * @return wcaTokenWrapped amount of Wrapped Collateral Asset minted to the recipient
     */
    function _wrapTo(
        address assetAddress_,
        uint256 qAsset_,
        address sender_,
        address recipient_
    ) internal returns (uint256 wcaTokenWrapped) {
        wcaTokenWrapped = _convertAssetToToken(assetAddress_, qAsset_);
        // slither-disable-next-line unused-return
        wcaToken.mint(recipient_, wcaTokenWrapped);

        // transfer asset from sender to this contract
        SafeERC20.safeTransferFrom(IERC20(assetAddress_), sender_, address(this), qAsset_);
        return wcaTokenWrapped;
    }

    /**
     * @notice given an amount of wrapped tokens `wcaTokenAmount_`, converts to the equivalent value
     * in the given `assetAddress_` and transfer it to the `recipient_` address
     * @param assetAddress_ Asset contract address
     * @param wcaTokenAmount_ amount of wrapped tokens
     * @param qAssetMin_ minimum amount of Asset that expects to be received
     * @param sender_ address who sends the Wrapped Collateral Asset
     * @param recipient_ address who receives the Asset
     * @return assetAmount amount of Asset redeemed to the recipient
     */
    function _unwrapTo(
        address assetAddress_,
        uint256 wcaTokenAmount_,
        uint256 qAssetMin_,
        address sender_,
        address recipient_
    ) internal nonReentrant returns (uint256 assetAmount) {
        // calculate the equivalent amount of Asset
        (assetAmount, wcaTokenAmount_) = _convertTokenToAsset(assetAddress_, wcaTokenAmount_);
        if (assetAmount < qAssetMin_) revert QacBelowMinimumRequired(qAssetMin_, assetAmount);
        // burns the wcaToken for this user, will fail if insufficient funds
        wcaToken.burn(sender_, wcaTokenAmount_);
        // transfer Asset to the recipient, will fail if not enough assetAmount
        SafeERC20.safeTransfer(IERC20(assetAddress_), recipient_, assetAmount);
        return assetAmount;
    }

    // ------- Public Functions -------

    /**
     * @notice get wrapped token price
     * @return tokenPrice [PREC]
     */
    function getTokenPrice() public view returns (uint256 tokenPrice) {
        uint256 tokenTotalSupply = wcaToken.totalSupply();
        if (tokenTotalSupply == 0) return ONE;
        uint256 assetsLength = assets.length;
        uint256 totalCurrency;
        // loop through all assets to calculate the total amount of currency held
        for (uint256 i = 0; i < assetsLength; i = unchecked_inc(i)) {
            IERC20 asset = assets[i];
            // get asset balance
            uint256 assetBalance = asset.balanceOf(address(this));
            // multiply by actual asset price and add to the accumulated total currency
            // [PREC] = [N] * [PREC]
            totalCurrency += assetBalance * _getAssetPrice(address(asset));
        }
        // [PREC] = [PREC] / [N]
        return totalCurrency / tokenTotalSupply;
    }

    // ------- External Functions -------

    /**
     * @notice given an amount of wrapped tokens `wcaTokenAmount_`, converts to the equivalent value
     * in the given `assetAddress_` and transfer it to the `recipient_` address
     * @param assetAddress_ Asset contract address
     * @param wcaTokenAmount_ amount of wrapped tokens
     * @param qAssetMin_ minimum expected Asset amount to be received
     * @param recipient_ address who receives the Asset
     */
    function unwrapTo(
        address assetAddress_,
        uint256 wcaTokenAmount_,
        uint256 qAssetMin_,
        address recipient_
    ) external validAsset(assetAddress_) {
        _unwrapTo(assetAddress_, wcaTokenAmount_, qAssetMin_, msg.sender, recipient_);
    }

    /**
     * @notice adds an asset to the whitelist, or modifies PriceProvider if already exists
     * @param asset_ Asset contract address
     * @param priceProvider_ Asset Price Provider contract address
     * @param assetDecimals_ Asset decimal places
     */
    function addOrEditAsset(
        IERC20 asset_,
        IPriceProvider priceProvider_,
        uint8 assetDecimals_
    ) external onlyAuthorizedChanger {
        // verifies it is a valid priceProvider
        (, bool has) = priceProvider_.peek();
        if (!has) revert InvalidAddress();
        if (!assetIndex[address(asset_)].exists) {
            assetIndex[address(asset_)] = AssetIndex({
                index: uint256(assets.length),
                exists: true,
                shift: 18 - int8(assetDecimals_)
            });
            assets.push(asset_);
        }
        priceProviderMap[address(asset_)] = priceProvider_;
        emit AssetModified(address(asset_), address(priceProvider_));
    }

    /**
     * @notice caller sends Asset and receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     */
    function mintTC(address assetAddress_, uint256 qTC_, uint256 qAssetMax_) external {
        MintTCParams memory params = MintTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _mintTCto(params);
    }

    /**
     * @notice caller sends Asset and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param vendor_ address who receives a markup
     */
    function mintTCViaVendor(address assetAddress_, uint256 qTC_, uint256 qAssetMax_, address vendor_) external {
        MintTCParams memory params = MintTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _mintTCto(params);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     */
    function mintTCto(address assetAddress_, uint256 qTC_, uint256 qAssetMax_, address recipient_) external {
        MintTCParams memory params = MintTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _mintTCto(params);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     */
    function mintTCtoViaVendor(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMax_,
        address recipient_,
        address vendor_
    ) external {
        MintTCParams memory params = MintTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _mintTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Asset
        Requires prior sender approval of Collateral Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that sender expects to receive
     */
    function redeemTC(address assetAddress_, uint256 qTC_, uint256 qAssetMin_) external {
        RedeemTCParams memory params = RedeemTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Collateral Token to this contract
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that sender expects to receive
     * @param vendor_ address who receives a markup
     */
    function redeemTCViaVendor(address assetAddress_, uint256 qTC_, uint256 qAssetMin_, address vendor_) external {
        RedeemTCParams memory params = RedeemTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Asset
        Requires prior sender approval of Collateral Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Asset
     */
    function redeemTCto(address assetAddress_, uint256 qTC_, uint256 qAssetMin_, address recipient_) external {
        RedeemTCParams memory params = RedeemTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Collateral Token to this contract
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Asset
     * @param vendor_ address who receives a markup
     */
    function redeemTCtoViaVendor(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMin_,
        address recipient_,
        address vendor_
    ) external {
        RedeemTCParams memory params = RedeemTCParams({
            assetAddress: assetAddress_,
            qTC: qTC_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _redeemTCto(params);
    }

    /**
     * @notice caller sends Asset and receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     */
    function mintTP(address assetAddress_, uint256 i_, uint256 qTP_, uint256 qAssetMax_) external {
        MintTPParams memory params = MintTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _mintTPto(params);
    }

    /**
     * @notice caller sends Asset and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param vendor_ address who receives a markup
     */
    function mintTPViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address vendor_
    ) external {
        MintTPParams memory params = MintTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _mintTPto(params);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     */
    function mintTPto(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        MintTPParams memory params = MintTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _mintTPto(params);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     */
    function mintTPtoViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address recipient_,
        address vendor_
    ) external {
        MintTPParams memory params = MintTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _mintTPto(params);
    }

    /**
     * @notice caller sends Pegged Token and receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum Asset amount that sender expects to be received
     */
    function redeemTP(address assetAddress_, uint256 i_, uint256 qTP_, uint256 qAssetMin_) external {
        RedeemTPParams memory params = RedeemTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0),
            isLiqRedeem: false
        });
        _redeemTPto(params);
    }

    /**
     * @notice caller sends Pegged Token and receives Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Pegged Token to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum Asset amount that sender expects to be received
     * @param vendor_ address who receives a markup
     */
    function redeemTPViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address vendor_
    ) external {
        RedeemTPParams memory params = RedeemTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_,
            isLiqRedeem: false
        });
        _redeemTPto(params);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Asset
     */
    function redeemTPto(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address recipient_
    ) external {
        RedeemTPParams memory params = RedeemTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0),
            isLiqRedeem: false
        });
        _redeemTPto(params);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Pegged Token to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Asset
     * @param vendor_ address who receives a markup
     */
    function redeemTPtoViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address recipient_,
        address vendor_
    ) external {
        RedeemTPParams memory params = RedeemTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_,
            isLiqRedeem: false
        });
        _redeemTPto(params);
    }

    /**
     * @notice on liquidation, caller claims all Pegged Token `i_` and receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     */
    function liqRedeemTP(address assetAddress_, uint256 i_) external {
        // qTP = 0 as it's calculated internally, liqRedeem = true
        RedeemTPParams memory params = RedeemTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: 0,
            qAssetMin: 0,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0),
            isLiqRedeem: true
        });
        _redeemTPto(params);
    }

    /**
     * @notice on liquidation, caller sends Pegged Token and recipient receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param recipient_ address who receives the Asset
     */
    function liqRedeemTPto(address assetAddress_, uint256 i_, address recipient_) external {
        // qTP = 0 as it's calculated internally, liqRedeem = true
        RedeemTPParams memory params = RedeemTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: 0,
            qAssetMin: 0,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0),
            isLiqRedeem: true
        });
        _redeemTPto(params);
    }

    /**
     * @notice caller sends Asset and receives Collateral Token and Pegged Token
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     */
    function mintTCandTP(address assetAddress_, uint256 i_, uint256 qTP_, uint256 qAssetMax_) external {
        MintTCandTPParams memory params = MintTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _mintTCandTPto(params);
    }

    /**
     * @notice caller sends Asset and receives Collateral Token and Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param vendor_ address who receives a markup
     */
    function mintTCandTPViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address vendor_
    ) external {
        MintTCandTPParams memory params = MintTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _mintTCandTPto(params);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token and Pegged Token
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     */
    function mintTCandTPto(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        MintTCandTPParams memory params = MintTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _mintTCandTPto(params);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token and Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @param vendor_ address who receives a markup
     */
    function mintTCandTPtoViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address recipient_,
        address vendor_
    ) external {
        MintTCandTPParams memory params = MintTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _mintTCandTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and receives Assets
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that the sender expects to receive
     */
    function redeemTCandTP(address assetAddress_, uint256 i_, uint256 qTC_, uint256 qTP_, uint256 qAssetMin_) external {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _redeemTCandTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and receives Assets
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that the sender expects to receive
     * @param vendor_ address who receives a markup
     */
    function redeemTCandTPViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address vendor_
    ) external {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _redeemTCandTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives Assets
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Asset
     */
    function redeemTCandTPto(
        address assetAddress_,
        uint256 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address recipient_
    ) external {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _redeemTCandTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives Assets
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Asset
     * @param vendor_ address who receives a markup
     */
    function redeemTCandTPtoViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address recipient_,
        address vendor_
    ) external {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qAssetMin: qAssetMin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _redeemTCandTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     */
    function swapTPforTP(
        address assetAddress_,
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qAssetMax_
    ) external {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            assetAddress: assetAddress_,
            iFrom: iFrom_,
            iTo: iTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _swapTPforTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param vendor_ address who receives a markup
     */
    function swapTPforTPViaVendor(
        address assetAddress_,
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address vendor_
    ) external {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            assetAddress: assetAddress_,
            iFrom: iFrom_,
            iTo: iTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _swapTPforTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param recipient_ address who receives the target Pegged Token
     */
    function swapTPforTPto(
        address assetAddress_,
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            assetAddress: assetAddress_,
            iFrom: iFrom_,
            iTo: iTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _swapTPforTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param recipient_ address who receives the target Pegged Token
     * @param vendor_ address who receives a markup
     */
    function swapTPforTPtoViaVendor(
        address assetAddress_,
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address recipient_,
        address vendor_
    ) external {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            assetAddress: assetAddress_,
            iFrom: iFrom_,
            iTo: iTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _swapTPforTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     */
    function swapTPforTC(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qAssetMax_
    ) external {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _swapTPforTCto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param vendor_ address who receives a markup
     */
    function swapTPforTCViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qAssetMax_,
        address vendor_
    ) external {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _swapTPforTCto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param recipient_ address who receives the Collateral Token
     */
    function swapTPforTCto(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _swapTPforTCto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     */
    function swapTPforTCtoViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qAssetMax_,
        address recipient_,
        address vendor_
    ) external {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            assetAddress: assetAddress_,
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _swapTPforTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     *  Requires prior sender approval of Collateral Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     */
    function swapTCforTP(
        address assetAddress_,
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qAssetMax_
    ) external {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        _swapTCforTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param vendor_ address who receives a markup
     */
    function swapTCforTPViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address vendor_
    ) external {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        _swapTCforTPto(params);
    }

    /**
     * @notice caller sends a Collateral Token and recipient receives Pegged Token
     *  Requires prior sender approval of Collateral Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param recipient_ address who receives the Pegged Token
     */
    function swapTCforTPto(
        address assetAddress_,
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        _swapTCforTPto(params);
    }

    /**
     * @notice caller sends a Collateral Token and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     */
    function swapTCforTPtoViaVendor(
        address assetAddress_,
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address recipient_,
        address vendor_
    ) external {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            assetAddress: assetAddress_,
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qAssetMax: qAssetMax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        _swapTCforTPto(params);
    }

    /*
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */

    // Purposely left unused to save some state space to allow for future upgrades
    // slither-disable-next-line unused-state
    uint256[50] private __gap;
}
