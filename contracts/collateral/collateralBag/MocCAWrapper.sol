pragma solidity ^0.8.16;

import "../../governance/MocUpgradable.sol";
import "../rc20/MocCARC20.sol";

/**
 * @title MocCAWrapper: Moc Collateral Asset Wrapper
 * @notice Wrappes a collection of ERC20 stablecoins to a token which is used as Collateral Asset by
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
    event TPSwapped(
        address asset_,
        uint8 indexed iFrom_,
        uint8 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_
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
        // true if asset token exist
        bool exist;
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
     * @param stopperAddress_ The address that is authorized to pause this contract
     * @param mocCoreAddress_ Moc Core contract address
     * @param wcaTokenAddress_ Wrapped Collateral Asset Token contract address
     */
    function initialize(
        address governorAddress_,
        address stopperAddress_,
        address mocCoreAddress_,
        address wcaTokenAddress_
    ) external initializer {
        if (mocCoreAddress_ == address(0)) revert InvalidAddress();
        if (wcaTokenAddress_ == address(0)) revert InvalidAddress();
        __MocUpgradable_init(governorAddress_, stopperAddress_);
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
        return assetIndex[assetAddress_].exist;
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
        // multply by wcaTokenAmount_ to get how many currency we need
        // [PREC] = [PREC] * [N]
        uint256 currencyNeeded = wcaTokenPrice * wcaTokenAmount_;
        // divide currencyNedded by asset price to get how many assets we need
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
        uint256 wcaMinted = _mintWCAto(assetAddress_, qAssetMax_, sender_, address(this));

        // mint TC to the recipient
        uint256 wcaUsed = mocCore.mintTCto(qTC_, wcaMinted, recipient_);
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _redeemWCAto(assetAddress_, wcaUnused, 0, address(this), sender_);
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
        // we pass '0' to qACmin parameter to do not revert by qAC below minimium since we are
        // checking it after with qAssetMin
        uint256 wcaTokenAmountRedeemed = mocCore.redeemTC(qTC_, 0);
        // send Asset to the recipient
        uint256 assetRedeemed = _redeemWCAto(
            assetAddress_,
            wcaTokenAmountRedeemed,
            qAssetMin_,
            address(this),
            recipient_
        );

        emit TCRedeemed(assetAddress_, sender_, recipient_, qTC_, assetRedeemed);
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
        uint256 wcaMinted = _mintWCAto(assetAddress_, qAssetMax_, sender_, address(this));

        // mint TP to the recipient
        uint256 wcaUsed = mocCore.mintTPto(i_, qTP_, wcaMinted, recipient_);
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _redeemWCAto(assetAddress_, wcaUnused, 0, address(this), sender_);
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
        // we pass '0' to qACmin parameter to do not revert by qAC below minimium since we are
        // checking it after with qAssetMin
        uint256 wcaTokenAmountRedeemed;
        if (isLiqRedeem_) wcaTokenAmountRedeemed = mocCore.liqRedeemTP(i_);
        else wcaTokenAmountRedeemed = mocCore.redeemTP(i_, qTP_, 0);
        // send Asset to the recipient
        uint256 assetRedeemed = _redeemWCAto(
            assetAddress_,
            wcaTokenAmountRedeemed,
            qAssetMin_,
            address(this),
            recipient_
        );
        emit TPRedeemed(assetAddress_, i_, sender_, recipient_, qTP_, assetRedeemed);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives Assets
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without check coverage
     *  Redeem Collateral Token and Pegged Token in equal proportions so that its price
     *  and global coverage are not modified. If the qTP are insufficient, less TC are redeemed
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that expect to be received
     * @param sender_ address who sends Collateral Token and Pegged Token
     * @param recipient_ address who receives the Collateral Asset
     */
    function _redeemTCandTPto(
        address assetAddress_,
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        // get Collateral Token contract address
        IERC20 tcToken = mocCore.tcToken();
        // get Pegged Token contract address
        IERC20 tpToken = mocCore.tpTokens(i_);
        // transfer Collateral Token from sender to this address
        SafeERC20.safeTransferFrom(tcToken, sender_, address(this), qTC_);
        // transfer Pegged Token from sender to this address
        SafeERC20.safeTransferFrom(tpToken, sender_, address(this), qTP_);
        // redeem Collateral Token and Pegged Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' to qACmin parameter to do not revert by qAC below minimium since we are
        // checking it after with qAssetMin
        (uint256 wcaTokenAmountRedeemed, uint256 qTCtoRedeem, uint256 qTPtoRedeem) = mocCore.redeemTCandTP(
            i_,
            qTC_,
            qTP_,
            0
        );
        // send Asset to the recipient
        _redeemWCAto(assetAddress_, wcaTokenAmountRedeemed, qAssetMin_, address(this), recipient_);
        // transfer unused Collateral Token to the sender
        SafeERC20.safeTransfer(tcToken, sender_, qTC_ - qTCtoRedeem);
        // transfer unused Pegged Token to the sender
        SafeERC20.safeTransfer(tpToken, sender_, qTP_ - qTPtoRedeem);
        // TODO: emit event?
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees and interests
     * @param sender_ address who sends the Pegged Token
     * @param recipient_ address who receives the target Pegged Token
     */
    function _swapTPforTPto(
        address assetAddress_,
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        uint256 wcaMinted = _mintWCAto(assetAddress_, qAssetMax_, sender_, address(this));

        // transfer Pegged Token from sender to this address
        SafeERC20.safeTransferFrom(mocCore.tpTokens(iFrom_), sender_, address(this), qTP_);
        uint256 wcaUsed = mocCore.swapTPforTPto(iFrom_, iTo_, qTP_, qTPmin_, wcaMinted, recipient_);
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        _redeemWCAto(assetAddress_, wcaUnused, 0, address(this), sender_);
        emit TPSwapped(assetAddress_, iFrom_, iTo_, sender_, recipient_, qTP_);
    }

    /**
     * @notice caller sends Asset and recipient receives Wrapped Collateral Asset
     *  Requires prior sender approval of Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param qAsset_ amount of Asset to be Wrapped
     * @param sender_ address who sends the Asset
     * @param recipient_ address who receives the Wrapped Collateral Asset
     * @return wcaMinted amount of Wrapped Collateral Asset minted to the recipient
     */
    function _mintWCAto(
        address assetAddress_,
        uint256 qAsset_,
        address sender_,
        address recipient_
    ) internal returns (uint256 wcaMinted) {
        wcaMinted = _convertAssetToToken(assetAddress_, qAsset_);
        wcaToken.mint(recipient_, wcaMinted);

        // transfer asset from sender to this contract
        SafeERC20.safeTransferFrom(IERC20(assetAddress_), sender_, address(this), qAsset_);
        return wcaMinted;
    }

    /**
     * @notice caller sends Wrapped Collateral Asset and recipient receives Asset
     *  Requires prior sender approval of Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param qWCA_ amount of Wrapped Collateral Asset to be unwrapped
     * @param qAssetMin_ minimum amount of Asset that expects to be received
     * @param sender_ address who sends the Wrapped Collateral Asset
     * @param recipient_ address who receives the Asset
     * @return assetRedeemed amount of Asset redeemed to the recipient
     */
    function _redeemWCAto(
        address assetAddress_,
        uint256 qWCA_,
        uint256 qAssetMin_,
        address sender_,
        address recipient_
    ) internal returns (uint256 assetRedeemed) {
        // calculate the equivalent amount of Asset
        assetRedeemed = _convertTokenToAsset(assetAddress_, qWCA_);
        if (assetRedeemed < qAssetMin_) revert QacBelowMinimumRequired(qAssetMin_, assetRedeemed);
        // burn the wcaToken redeemed
        wcaToken.burn(sender_, qWCA_);
        // transfer Asset to the recipient
        SafeERC20.safeTransfer(IERC20(assetAddress_), recipient_, assetRedeemed);
        return assetRedeemed;
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
     * TODO: this function should be called only through governance system
     * @param assetAddress_ Asset contract address
     * @param priceProviderAddress_ Asset Price Provider contract address
     */
    function addAsset(address assetAddress_, address priceProviderAddress_) external {
        if (assetAddress_ == address(0)) revert InvalidAddress();
        IPriceProvider priceProvider = IPriceProvider(priceProviderAddress_);
        // verifies it is a valid priceProvider
        (, bool has) = priceProvider.peek();
        if (!has) revert InvalidAddress();

        if (assetIndex[address(assetAddress_)].exist) revert AssetAlreadyAdded();
        assetIndex[address(assetAddress_)] = AssetIndex({ index: uint8(assets.length), exist: true });

        assets.push(IERC20(assetAddress_));
        priceProviderMap[assetAddress_] = priceProvider;
        emit AssetAdded(assetAddress_, priceProviderAddress_);
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

    /**
     * @notice caller sends Collateral Token and Pegged Token and receives Assets
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without check coverage
     *  Redeem Collateral Token and Pegged Token in equal proportions so that its price
     *  and global coverage are not modified. If the qTP are insufficient, less TC are redeemed
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that the sender expects to receive
     */
    function redeemTCandTP(
        address assetAddress_,
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAssetMin_
    ) external {
        _redeemTCandTPto(assetAddress_, i_, qTC_, qTP_, qAssetMin_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives Assets
     *  Requires prior sender approval of Collateral Token and Pegged Token to this contract
     *  This operation is done without check coverage
     *  Redeem Collateral Token and Pegged Token in equal proportions so that its price
     *  and global coverage are not modified. If the qTP are insufficient, less TC are redeemed
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qAssetMin_ minimum amount of Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     */
    function redeemTCandTPto(
        address assetAddress_,
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAssetMin_,
        address recipient_
    ) external {
        _redeemTCandTPto(assetAddress_, i_, qTC_, qTP_, qAssetMin_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees and interests
     */
    function swapTPforTP(
        address assetAddress_,
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qAssetMax_
    ) external {
        _swapTPforTPto(assetAddress_, iFrom_, iTo_, qTP_, qTPmin_, qAssetMax_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees and interests
     * @param recipient_ address who receives the target Pegged Token
     */
    function swapTPforTPto(
        address assetAddress_,
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        _swapTPforTPto(assetAddress_, iFrom_, iTo_, qTP_, qTPmin_, qAssetMax_, msg.sender, recipient_);
    }

    /*
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
