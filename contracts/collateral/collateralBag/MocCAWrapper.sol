pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../../utils/MocHelper.sol";
import "../rc20/MocCARC20.sol";

/**
 * @title MocCAWrapper: Moc Collateral Asset Wrapper
 * @notice Wrappes a collection of ERC20 stablecoins to a token which is used as Collateral Asset by
 *  Moc Collateral Asset Bag protocol implementation
 */
contract MocCAWrapper is MocHelper, Initializable {
    // ------- Custom Errors -------
    error AssetAlreadyAdded();
    error InvalidPriceProvider(address priceProviderAddress_);
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNedeed_);
    // ------- Structs -------
    struct Asset {
        // asset token
        IERC20 asset;
        // asset price provider
        IPriceProvider priceProvider;
    }

    // ------- Storage -------

    // Wrapped Collateral Asset token
    MocRC20 private wcaToken;
    // Moc Core protocol
    MocCARC20 private mocCore;
    // array of valid assets in the bag
    Asset[] private assets;
    // asset -> priceProvider, and is used to check if an asset is valid
    mapping(address => IPriceProvider) internal priceProviderMap;

    // ------- Modifiers -------
    modifier validAsset(address assetAddress_) {
        if (!_isValidAsset(assetAddress_)) revert InvalidAddress();
        _;
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param mocCoreAddress_ Moc Core contract address
     * @param wcaTokenAddress_ Wrapped Collateral Asset Token contract address
     */
    function initialize(address mocCoreAddress_, address wcaTokenAddress_) external initializer {
        if (mocCoreAddress_ == address(0)) revert InvalidAddress();
        if (wcaTokenAddress_ == address(0)) revert InvalidAddress();
        mocCore = MocCARC20(mocCoreAddress_);
        wcaToken = MocRC20(wcaTokenAddress_);
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
        return address(priceProviderMap[assetAddress_]) != address(0);
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
        uint256 currencyNedeed = wcaTokenPrice * wcaTokenAmount_;
        // divide currencyNedded by asset price to get how many assets we need
        // [N] = [PREC] / [PREC]
        return currencyNedeed / _getAssetPrice(priceProviderMap[assetAddress_]);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Asset that can be spent
     * @param sender_ address who sends the Asset
     * @param recipient_ address who receives the Collateral Token
     */
    function _mintTCto(
        address assetAddress_,
        uint256 qTC_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal validAsset(assetAddress_) {
        // ask to Moc Core how many qAC(Wrapper Collateral Asset) are nedeed to mint qTC
        (uint256 qACtoMint, uint256 qACfee) = mocCore.calcQACforMintTC(qTC_);
        uint256 qAC = qACtoMint + qACfee;
        // calculates the equivalent value in the given asset
        uint256 assetNedeed = _convertTokenToAsset(assetAddress_, qAC);
        wcaToken.mint(address(this), qAC);

        if (assetNedeed > qACmax_) revert InsufficientQacSent(qACmax_, assetNedeed);

        // transfer asset from sender to this contract
        SafeERC20.safeTransferFrom(IERC20(assetAddress_), sender_, address(this), assetNedeed);

        // mint TC to the recipient
        mocCore.mintTCto(qTC_, qAC, recipient_);
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
        for (uint256 i = 0; i < assetsLength; i++) {
            Asset memory asset = assets[i];
            // get asset balance
            uint256 assetBalance = asset.asset.balanceOf(address(this));
            // multiply by actual asset price and add to the accumulated total currency
            // [PREC] = [N] * [PREC]
            totalCurrency += assetBalance * _getAssetPrice(asset.priceProvider);
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
        if (priceProviderAddress_ == address(0)) revert InvalidAddress();
        if (address(priceProviderMap[assetAddress_]) != address(0)) revert AssetAlreadyAdded();

        assets.push(Asset({ asset: IERC20(assetAddress_), priceProvider: IPriceProvider(priceProviderAddress_) }));
        priceProviderMap[assetAddress_] = IPriceProvider(priceProviderAddress_);
    }

    /**
     * @notice caller sends Asset and receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Asset that can be spent
     */
    function mintTC(
        address assetAddress_,
        uint256 qTC_,
        uint256 qACmax_
    ) external {
        _mintTCto(assetAddress_, qTC_, qACmax_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Asset and recipient receives Collateral Token
        Requires prior sender approval of Asset to this contract 
     * @param assetAddress_ Asset contract address
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     */
    function mintTCto(
        address assetAddress_,
        uint256 qTC_,
        uint256 qACmax_,
        address recipient_
    ) external {
        _mintTCto(assetAddress_, qTC_, qACmax_, msg.sender, recipient_);
    }
}
