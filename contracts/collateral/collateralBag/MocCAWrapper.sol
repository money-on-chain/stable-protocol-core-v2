pragma solidity ^0.8.17;

import "../../governance/MocUpgradable.sol";
import "../rc20/MocCARC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
    event TCandTPRedeemed(
        address asset_,
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event TPSwappedForTP(
        address asset_,
        uint8 indexed iFrom_,
        uint8 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTCto_,
        uint256 qAsset_
    );
    event TPSwappedForTCWithWrapper(
        address asset_,
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qTC_,
        uint256 qAsset_
    );
    event TCSwappedForTPWithWrapper(
        address asset_,
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAsset_
    );
    event AssetModified(address indexed assetAddress_, address priceProviderAddress);

    // ------- Custom Errors -------
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
        if (!has) revert InvalidPriceProvider(address(priceProviderMap[assetAddress_]));
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
    ) internal view returns (uint256 assetAmount) {
        // get the wrapped token price = totalCurrency / wcaTokenTotalSupply
        // [PREC]
        uint256 wcaTokenPrice = getTokenPrice();
        // multiply by wcaTokenAmount_ to get how many currency we need
        // [PREC] = [PREC] * [N]
        uint256 currencyNeeded = wcaTokenPrice * wcaTokenAmount_;
        // divide currencyNeeded by asset price to get how many assets we need
        // [N] = [PREC] / [PREC]
        return currencyNeeded / _getAssetPrice(assetAddress_);
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
        uint256 wcaMinted = _wrapFromAssetTo(assetAddress_, qAssetMax_, sender_, address(this));

        // mint TC to the recipient
        uint256 wcaUsed = mocCore.mintTCto(qTC_, wcaMinted, recipient_);
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapToAssetTo(assetAddress_, wcaUnused, 0, address(this), sender_);
        emit TCMinted(assetAddress_, sender_, recipient_, qTC_, qAssetMax_ - assetUnused);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Assets
        Requires prior sender approval of Collateral Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum expected Asset amount to be received
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
        IERC20Upgradeable tcToken = mocCore.tcToken();
        // transfer Collateral Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tcToken, sender_, address(this), qTC_);
        // redeem Collateral Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' to qACmin parameter to do not revert by qAC below minimum since we are
        // checking it after with qAssetMin
        uint256 wcaTokenAmountRedeemed = mocCore.redeemTC(qTC_, 0);
        // send Asset to the recipient
        uint256 assetRedeemed = _unwrapToAssetTo(
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
        uint256 wcaMinted = _wrapFromAssetTo(assetAddress_, qAssetMax_, sender_, address(this));

        // mint TP to the recipient
        uint256 wcaUsed = mocCore.mintTPto(i_, qTP_, wcaMinted, recipient_);
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapToAssetTo(assetAddress_, wcaUnused, 0, address(this), sender_);
        emit TPMinted(assetAddress_, i_, sender_, recipient_, qTP_, qAssetMax_ - assetUnused);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Assets
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum expected Asset amount to be received
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
        IERC20Upgradeable tpToken = mocCore.tpTokens(i_);
        // When liquidating, we extract all the user's balance
        if (isLiqRedeem_) qTP_ = tpToken.balanceOf(sender_);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpToken, sender_, address(this), qTP_);
        // redeem Pegged Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' to qACmin parameter to do not revert by qAC below minimum since we are
        // checking it after with qAssetMin
        uint256 wcaTokenAmountRedeemed;
        if (isLiqRedeem_) wcaTokenAmountRedeemed = mocCore.liqRedeemTP(i_);
        else wcaTokenAmountRedeemed = mocCore.redeemTP(i_, qTP_, 0);
        // send Asset to the recipient
        uint256 assetRedeemed = _unwrapToAssetTo(
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
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
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
        IERC20Upgradeable tcToken = mocCore.tcToken();
        // get Pegged Token contract address
        IERC20Upgradeable tpToken = mocCore.tpTokens(i_);
        // transfer Collateral Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tcToken, sender_, address(this), qTC_);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpToken, sender_, address(this), qTP_);
        // redeem Collateral Token and Pegged Token in exchange of Wrapped Collateral Asset Token
        // we pass '0' as qACmin parameter to avoid reverting by qAC below minimum since we are
        // checking it after with qAssetMin
        (uint256 wcaTokenAmountRedeemed, uint256 qTPtoRedeem) = mocCore.redeemTCandTP(i_, qTC_, qTP_, 0);
        // send Asset to the recipient
        uint256 assetRedeemed = _unwrapToAssetTo(
            assetAddress_,
            wcaTokenAmountRedeemed,
            qAssetMin_,
            address(this),
            recipient_
        );
        // transfer unused Pegged Token to the sender
        SafeERC20Upgradeable.safeTransfer(tpToken, sender_, qTP_ - qTPtoRedeem);
        // inside a block to avoid stack too deep error
        {
            address assetAddress = assetAddress_;
            uint256 qTC = qTC_;
            emit TCandTPRedeemed(assetAddress, i_, sender_, recipient_, qTC, qTPtoRedeem, assetRedeemed);
        }
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
        uint256 wcaMinted = _wrapFromAssetTo(assetAddress_, qAssetMax_, sender_, address(this));
        // get Pegged Token contract address
        IERC20Upgradeable tpTokenFrom = mocCore.tpTokens(iFrom_);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpTokenFrom, sender_, address(this), qTP_);
        (uint256 wcaUsed, uint256 qTPtoMint) = mocCore.swapTPforTPto(
            iFrom_,
            iTo_,
            qTP_,
            qTPmin_,
            wcaMinted,
            recipient_
        );
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapToAssetTo(assetAddress_, wcaUnused, 0, address(this), sender_);
        // inside a block to avoid stack too deep error
        {
            address assetAddress = assetAddress_;
            uint8 iFrom = iFrom_;
            uint8 iTo = iTo_;
            uint256 qTP = qTP_;
            uint256 qAssetUsed = qAssetMax_ - assetUnused;
            emit TPSwappedForTP(assetAddress, iFrom, iTo, sender_, recipient_, qTP, qTPtoMint, qAssetUsed);
        }
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ owned Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees and interests
     * @param sender_ address who sends the Pegged Token
     * @param recipient_ address who receives the Collateral Token
     */
    function _swapTPforTCto(
        address assetAddress_,
        uint8 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qAssetMax_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        uint256 wcaMinted = _wrapFromAssetTo(assetAddress_, qAssetMax_, sender_, address(this));
        // get Pegged Token contract address
        IERC20Upgradeable tpToken = mocCore.tpTokens(i_);
        // transfer Pegged Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tpToken, sender_, address(this), qTP_);
        (uint256 wcaUsed, uint256 qTCtoMint) = mocCore.swapTPforTCto(i_, qTP_, qTCmin_, wcaMinted, recipient_);
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapToAssetTo(assetAddress_, wcaUnused, 0, address(this), sender_);
        // inside a block to avoid stack too deep error
        {
            address assetAddress = assetAddress_;
            uint8 i = i_;
            uint256 qTP = qTP_;
            uint256 qAssetUsed = qAssetMax_ - assetUnused;
            emit TPSwappedForTCWithWrapper(assetAddress, i, sender_, recipient_, qTP, qTCtoMint, qAssetUsed);
        }
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Pegged Token
     *  Requires prior sender approval of Collateral Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ owned Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees
     * @param sender_ address who sends the Collateral Token
     * @param recipient_ address who receives the Pegged Token
     */
    function _swapTCforTPto(
        address assetAddress_,
        uint8 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        uint256 wcaMinted = _wrapFromAssetTo(assetAddress_, qAssetMax_, sender_, address(this));
        // get Pegged Token contract address
        IERC20Upgradeable tcToken = mocCore.tcToken();
        // transfer Collateral Token from sender to this address
        SafeERC20Upgradeable.safeTransferFrom(tcToken, sender_, address(this), qTC_);
        (uint256 wcaUsed, uint256 qTPMinted) = mocCore.swapTCforTPto(i_, qTC_, qTPmin_, wcaMinted, recipient_);
        uint256 wcaUnused = wcaMinted - wcaUsed;
        // send back Asset unused to the sender
        // we pass '0' to qAssetMin parameter because we check when minting how much is the maximum
        // that can be spent
        uint256 assetUnused = _unwrapToAssetTo(assetAddress_, wcaUnused, 0, address(this), sender_);
        // inside a block to avoid stack too deep error
        {
            address assetAddress = assetAddress_;
            uint8 i = i_;
            uint256 qTC = qTC_;
            uint256 qAssetUsed = qAssetMax_ - assetUnused;
            emit TCSwappedForTPWithWrapper(assetAddress, i, sender_, recipient_, qTC, qTPMinted, qAssetUsed);
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
    function _wrapFromAssetTo(
        address assetAddress_,
        uint256 qAsset_,
        address sender_,
        address recipient_
    ) internal returns (uint256 wcaTokenWrapped) {
        wcaTokenWrapped = _convertAssetToToken(assetAddress_, qAsset_);
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
    function _unwrapToAssetTo(
        address assetAddress_,
        uint256 wcaTokenAmount_,
        uint256 qAssetMin_,
        address sender_,
        address recipient_
    ) internal returns (uint256 assetAmount) {
        // calculate the equivalent amount of Asset
        assetAmount = _convertTokenToAsset(assetAddress_, wcaTokenAmount_);
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
        for (uint8 i = 0; i < assetsLength; i = unchecked_inc(i)) {
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
    function unwrapToAsset(
        address assetAddress_,
        uint256 wcaTokenAmount_,
        uint256 qAssetMin_,
        address recipient_
    ) external validAsset(assetAddress_) {
        _unwrapToAssetTo(assetAddress_, wcaTokenAmount_, qAssetMin_, msg.sender, recipient_);
    }

    /**
     * @notice adds an asset to the whitelist, or modifies PriceProvider if already exists
     * @param asset_ Asset contract address
     * @param priceProvider_ Asset Price Provider contract address
     */
    function addOrEditAsset(IERC20 asset_, IPriceProvider priceProvider_) external onlyAuthorizedChanger {
        // verifies it is a valid priceProvider
        (, bool has) = priceProvider_.peek();
        if (!has) revert InvalidAddress();
        if (!assetIndex[address(asset_)].exists) {
            assetIndex[address(asset_)] = AssetIndex({ index: uint8(assets.length), exists: true });
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
    function mintTCto(address assetAddress_, uint256 qTC_, uint256 qAssetMax_, address recipient_) external {
        _mintTCto(assetAddress_, qTC_, qAssetMax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Collateral Token and receives Asset
        Requires prior sender approval of Collateral Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to redeem
     * @param qAssetMin_ minimum amount of Asset that sender expects to receive
     */
    function redeemTC(address assetAddress_, uint256 qTC_, uint256 qAssetMin_) external {
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
    function redeemTCto(address assetAddress_, uint256 qTC_, uint256 qAssetMin_, address recipient_) external {
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
    function mintTP(address assetAddress_, uint8 i_, uint256 qTP_, uint256 qAssetMax_) external {
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
    function mintTPto(address assetAddress_, uint8 i_, uint256 qTP_, uint256 qAssetMax_, address recipient_) external {
        _mintTPto(assetAddress_, i_, qTP_, qAssetMax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Pegged Token and receives Asset
        Requires prior sender approval of Pegged Token to this contract 
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qAssetMin_ minimum Asset amount that sender expects to be received
     */
    function redeemTP(address assetAddress_, uint8 i_, uint256 qTP_, uint256 qAssetMin_) external {
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
    function liqRedeemTPto(address assetAddress_, uint8 i_, address recipient_) external {
        // qTP = 0 as it's calculated internally, liqRedeem = true
        _redeemTPto(assetAddress_, i_, 0, 0, msg.sender, recipient_, true);
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
    function redeemTCandTP(address assetAddress_, uint8 i_, uint256 qTC_, uint256 qTP_, uint256 qAssetMin_) external {
        _redeemTCandTPto(assetAddress_, i_, qTC_, qTP_, qAssetMin_, msg.sender, msg.sender);
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

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees and interests
     */
    function swapTPforTC(address assetAddress_, uint8 i_, uint256 qTP_, uint256 qTCmin_, uint256 qAssetMax_) external {
        _swapTPforTCto(assetAddress_, i_, qTP_, qTCmin_, qAssetMax_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  Requires prior sender approval of Pegged Token and Asset to this contract
     * @param assetAddress_ Asset contract address
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qAssetMax_ maximum amount of Asset that can be spent in fees and interests
     * @param recipient_ address who receives the Collateral Token
     */
    function swapTPforTCto(
        address assetAddress_,
        uint8 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        _swapTPforTCto(assetAddress_, i_, qTP_, qTCmin_, qAssetMax_, msg.sender, recipient_);
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
    function swapTCforTP(address assetAddress_, uint8 i_, uint256 qTC_, uint256 qTPmin_, uint256 qAssetMax_) external {
        _swapTCforTPto(assetAddress_, i_, qTC_, qTPmin_, qAssetMax_, msg.sender, msg.sender);
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
        uint8 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qAssetMax_,
        address recipient_
    ) external {
        _swapTCforTPto(assetAddress_, i_, qTC_, qTPmin_, qAssetMax_, msg.sender, recipient_);
    }

    /*
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
