pragma solidity ^0.8.17;

import "../../governance/MocUpgradable.sol";
import "../rc20/MocCARC20.sol";

/**
 * @title MocCAWrapper: Moc Collateral Asset Wrapper
 * @notice Wraps a collection of ERC20 stablecoins to a token which is used as Collateral Asset by
 *  Moc Collateral Asset Bag protocol implementation
 */
contract MocCAWrapper is MocUpgradable {
    // ------- Events -------
    event TCMinted(address asset_, address indexed sender_, address indexed recipient_, uint256 qTC_, uint256 qAsset_);
    event TCRedeemed(
        address asset_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAsset_
    );
    event TPMinted(
        address asset_,
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event TPRedeemed(
        address asset_,
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event AssetAdded(address indexed assetAddress_, address priceProviderAddress);
    // ------- Custom Errors -------
    error AssetAlreadyAdded();
    error InvalidPriceProvider(address priceProviderAddress_);
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    // ------- Structs -------
    struct AssetIndex {
        // asset index
        uint8 index;
        // true if asset token exists
        bool exists;
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
        SafeERC20.safeApprove(wcaToken, mocCoreAddress_, UINT256_MAX);
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
     * @param priceProviderAddress_ Asset Price Provider contract address
     * @return price [PREC]
     */
    function _getAssetPrice(IPriceProvider priceProviderAddress_) internal view returns (uint256) {
        (bytes32 price, bool has) = priceProviderAddress_.peek();
        if (!has) revert InvalidPriceProvider(address(priceProviderAddress_));
        return uint256(price);
    }

    /**
     * @notice given an amount of Asset, calculates the equivalent value in wrapped tokens
     * @param assetAddress_ Asset contract address
     * @param assetAmount_ amount of Asset to wrap
     * @return wcaTokenAmount amount of wcaToken [N]
     */
    function _convertAssetToToken(address assetAddress_, uint256 assetAmount_)
        internal
        view
        returns (uint256 wcaTokenAmount)
    {
        // get the wrapped token price = totalCurrency / wcaTokenTotalSupply
        // [PREC]
        uint256 wcaTokenPrice = getTokenPrice();
        // calculate how much currency will increment the pool
        // [PREC] = [N] * [PREC]
        uint256 currencyToAdd = assetAmount_ * _getAssetPrice(priceProviderMap[assetAddress_]);
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
    function _convertTokenToAsset(address assetAddress_, uint256 wcaTokenAmount_)
        internal
        view
        returns (uint256 assetAmount)
    {
        // get the wrapped token price = totalCurrency / wcaTokenTotalSupply
        // [PREC]
        uint256 wcaTokenPrice = getTokenPrice();
        // multiply by wcaTokenAmount_ to get how many currency we need
        // [PREC] = [PREC] * [N]
        uint256 currencyNeeded = wcaTokenPrice * wcaTokenAmount_;
        // divide currencyNeeded by asset price to get how many assets we need
        // [N] = [PREC] / [PREC]
        return currencyNeeded / _getAssetPrice(priceProviderMap[assetAddress_]);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param sender_ address who sends the Asset
     * @param recipient_ address who receives the Collateral Token
     */
    function _mintTCto(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMax_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        uint256 tokenToMint = _convertAssetToToken(assetAddress_, qAssetMax_);
        wcaToken.mint(address(this), tokenToMint);

        // transfer asset from sender to this contract
        SafeERC20.safeTransferFrom(IERC20(assetAddress_), sender_, address(this), qAssetMax_);

        // mint TC to the recipient
        uint256 tokenUsed = mocCore.mintTCto(qTC_, tokenToMint, recipient_);
        uint256 tokenUnused = tokenToMint - tokenUsed;

        // calculates the equivalent value in the given asset
        uint256 assetUnused = _convertTokenToAsset(assetAddress_, tokenUnused);
        wcaToken.burn(address(this), tokenUnused);

        // transfer back to sender the unused asset
        SafeERC20.safeTransfer(IERC20(assetAddress_), sender_, assetUnused);
        emit TCMinted(assetAddress_, sender_, recipient_, qTC_, qAssetMax_ - assetUnused);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Assets
        Requires prior sender approval of Collateral Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that expect to be received
     * @param sender_ address who sends the Collateral Token
     * @param recipient_ address who receives the Asset
     */
    function _redeemTCto(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMin_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        // get Collateral Token contract address
        IERC20 tcToken = mocCore.tcToken();
        // transfer Collateral Token from sender to this address
        SafeERC20.safeTransferFrom(tcToken, sender_, address(this), qTC_);
        // redeem Collateral Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' to qACmin parameter to do not revert by qAC below minimum since we are
        // checking it after with qAssetMin
        uint256 wcaTokenAmountRedeemed = mocCore.redeemTC(qTC_, 0);
        // calculate the equivalent amount of Asset
        uint256 assetAmount = _convertTokenToAsset(assetAddress_, wcaTokenAmountRedeemed);
        if (assetAmount < qAssetMin_) revert QacBelowMinimumRequired(qAssetMin_, assetAmount);
        // burn the wcaToken redeemed
        wcaToken.burn(address(this), wcaTokenAmountRedeemed);
        // transfer Asset to the recipient
        SafeERC20.safeTransfer(IERC20(assetAddress_), recipient_, assetAmount);
        emit TCRedeemed(assetAddress_, sender_, recipient_, qTC_, assetAmount);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param sender_ address who sends the Asset
     * @param recipient_ address who receives the Collateral Token
     */
    function _mintTPto(
        address assetAddress_,
        uint8 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        uint256 tokenToMint = _convertAssetToToken(assetAddress_, qAssetMax_);
        wcaToken.mint(address(this), tokenToMint);

        // transfer asset from sender to this contract
        SafeERC20.safeTransferFrom(IERC20(assetAddress_), sender_, address(this), qAssetMax_);

        // mint TP to the recipient
        uint256 tokenUsed = mocCore.mintTPto(i_, qTP_, tokenToMint, recipient_);
        uint256 tokenUnused = tokenToMint - tokenUsed;

        // calculates the equivalent value in the given asset
        uint256 assetUnused = _convertTokenToAsset(assetAddress_, tokenUnused);
        wcaToken.burn(address(this), tokenUnused);

        // transfer back to sender the unused asset
        SafeERC20.safeTransfer(IERC20(assetAddress_), sender_, assetUnused);
        emit TPMinted(assetAddress_, i_, sender_, recipient_, qTP_, qAssetMax_ - assetUnused);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Assets
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that expect to be received
     * @param sender_ address who sends the Pegged Token
     * @param recipient_ address who receives the Asset
     */
    function _redeemTPto(
        address assetAddress_,
        uint8 i_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address sender_,
        address recipient_,
        bool isLiqRedeem_
    ) internal validAsset(assetAddress_) {
        // get Pegged Token contract address
        IERC20 tpToken = mocCore.tpTokens(i_);
        // When liquidating, we extract all the user's balance
        if (isLiqRedeem_) qTP_ = tpToken.balanceOf(sender_);
        // transfer Pegged Token from sender to this address
        SafeERC20.safeTransferFrom(tpToken, sender_, address(this), qTP_);
        // redeem Pegged Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' to qACmin parameter to do not revert by qAC below minimum since we are
        // checking it after with qAssetMin

        uint256 wcaTokenAmountRedeemed;
        if (isLiqRedeem_) wcaTokenAmountRedeemed = mocCore.liqRedeemTP(i_);
        else wcaTokenAmountRedeemed = mocCore.redeemTP(i_, qTP_, 0);
        // calculate the equivalent amount of Asset
        uint256 assetAmount = _convertTokenToAsset(assetAddress_, wcaTokenAmountRedeemed);
        if (assetAmount < qAssetMin_) revert QacBelowMinimumRequired(qAssetMin_, assetAmount);
        // burn the wcaToken redeemed
        wcaToken.burn(address(this), wcaTokenAmountRedeemed);
        // transfer Asset to the recipient
        SafeERC20.safeTransfer(IERC20(assetAddress_), recipient_, assetAmount);
        emit TPRedeemed(assetAddress_, i_, sender_, recipient_, qTP_, assetAmount);
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
        for (uint8 i = 0; i < assetsLength; i = unchecked_inc(i)) {
            IERC20 asset = assets[i];
            // get asset balance
            uint256 assetBalance = asset.balanceOf(address(this));
            // multiply by actual asset price and add to the accumulated total currency
            // [PREC] = [N] * [PREC]
            totalCurrency += assetBalance * _getAssetPrice(priceProviderMap[address(asset)]);
        }
        // [PREC] = [PREC] / [N]
        return totalCurrency / tokenTotalSupply;
    }

    // ------- External Functions -------
    /**
     * @notice add an asset to the whitelist
     * @param asset_ Asset contract address
     * @param priceProvider_ Asset Price Provider contract address
     */
    function addAsset(IERC20 asset_, IPriceProvider priceProvider_) external onlyAuthorizedChanger {
        // verifies it is a valid priceProvider
        (, bool has) = priceProvider_.peek();
        if (!has) revert InvalidAddress();

        if (assetIndex[address(asset_)].exists) revert AssetAlreadyAdded();
        assetIndex[address(asset_)] = AssetIndex({ index: uint8(assets.length), exists: true });

        assets.push(asset_);
        priceProviderMap[address(asset_)] = priceProvider_;
        emit AssetAdded(address(asset_), address(priceProvider_));
    }

    /**
     * @notice caller sends Asset and receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     */
    function mintTC(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMax_
    ) external {
        _mintTCto(assetAddress_, qTC_, qAssetMax_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     */
    function mintTCto(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        _mintTCto(assetAddress_, qTC_, qAssetMax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Collateral Token and receives Asset
        Requires prior sender approval of Collateral Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that sender expects receive
     */
    function redeemTC(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMin_
    ) external {
        _redeemTCto(assetAddress_, qTC_, qAssetMin_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Asset
        Requires prior sender approval of Collateral Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Asset
     */
    function redeemTCto(
        address assetAddress_,
        uint256 qTC_,
        uint256 qAssetMin_,
        address recipient_
    ) external {
        _redeemTCto(assetAddress_, qTC_, qAssetMin_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Asset and receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Collateral Token to mint
     * @param qAssetMax_ maximum amount of Asset that can be spent
     */
    function mintTP(
        address assetAddress_,
        uint8 i_,
        uint256 qTP_,
        uint256 qAssetMax_
    ) external {
        _mintTPto(assetAddress_, i_, qTP_, qAssetMax_, msg.sender, msg.sender);
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
        uint8 i_,
        uint256 qTP_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        _mintTPto(assetAddress_, i_, qTP_, qAssetMax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Pegged Token and receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that sender expects receive
     */
    function redeemTP(
        address assetAddress_,
        uint8 i_,
        uint256 qTP_,
        uint256 qAssetMin_
    ) external {
        _redeemTPto(assetAddress_, i_, qTP_, qAssetMin_, msg.sender, msg.sender, false);
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
        uint8 i_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address recipient_
    ) external {
        _redeemTPto(assetAddress_, i_, qTP_, qAssetMin_, msg.sender, recipient_, false);
    }

    /**
     * @notice on liquidation, caller claims all Pegged Token `i_` and receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     */
    function liqRedeemTP(address assetAddress_, uint8 i_) external {
        // qTP = 0 as it's calculated internally, liqRedeem = true
        _redeemTPto(assetAddress_, i_, 0, 0, msg.sender, msg.sender, true);
    }

    /**
     * @notice on liquidation, caller sends Pegged Token and recipient receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param recipient_ address who receives the Asset
     */
    function liqRedeemTPto(
        address assetAddress_,
        uint8 i_,
        address recipient_
    ) external {
        // qTP = 0 as it's calculated internally, liqRedeem = true
        _redeemTPto(assetAddress_, i_, 0, 0, msg.sender, recipient_, true);
    }

    /*
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
