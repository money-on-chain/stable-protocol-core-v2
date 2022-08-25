pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../../utils/MocHelper.sol";
import "./MocCARBag.sol";

/**
 * @title MocCAWrapper: Moc Collateral Asset Wrapper
 * @notice Wrappes a collection of ERC20 stablecoins to a token which is used as Collateral Asset by
 *  Moc Collateral Asset Bag protocol implementation
 */
contract MocCAWrapper is MocHelper, Initializable {
    // ------- Custom Errors -------
    error AssetAlreadyWhitelisted();
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
    MocCARBag private mocCore;
    // array of valid assets in the bag
    Asset[] private assetsArray;
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
        mocCore = MocCARBag(mocCoreAddress_);
        wcaToken = MocRC20(wcaTokenAddress_);
        // infinite allowance to Moc Core
        wcaToken.approve(mocCoreAddress_, UINT256_MAX);
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
     * @notice given an amount of wrapped tokens calculate the equivalent in assets
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
     * @notice given an amount of wrapped tokens calculate the equivalent in assets
     * @param assetAddress_ Asset contract address
     * @param wcaTokenAmount_ amount of wrapped tokens to wrap
     * @param recipient_ address who receives the wrapped token
     * @return assetNedeed amount of Asset needed to wrap [N]
     */
    function _wrapTo(
        address assetAddress_,
        uint256 wcaTokenAmount_,
        address recipient_
    ) internal validAsset(assetAddress_) returns (uint256 assetNedeed) {
        if (wcaTokenAmount_ == 0) revert InvalidValue();
        if (recipient_ == address(0)) revert InvalidAddress();

        assetNedeed = _convertTokenToAsset(assetAddress_, wcaTokenAmount_);
        wcaToken.mint(recipient_, wcaTokenAmount_);
        return assetNedeed;
    }

    /**
     * @notice caller sends Asset and recipient address receives Collateral Token
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
    ) internal {
        // ask to Moc Core how many qAC(Wrapper Collateral Asset) are nedeed to mint qTC
        (uint256 qACtoMint, uint256 qACfee) = mocCore.calcQACforMintTC(qTC_);
        uint256 qAC = qACtoMint + qACfee;
        // wrap those amount of qAC using the asset sent
        uint256 assetNedeed = _wrapTo(assetAddress_, qAC, address(this));

        if (assetNedeed > qACmax_) revert InsufficientQacSent(qACmax_, assetNedeed);

        // transfer asset from sender to this contract
        bool success = IERC20(assetAddress_).transferFrom(sender_, address(this), assetNedeed);
        if (!success) revert TransferFail();

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
        uint256 assetsLength = assetsArray.length;
        uint256 totalCurrency;
        // loop through all assets to calculate the total amount of currency held
        for (uint256 i = 0; i < assetsLength; i++) {
            Asset memory asset = assetsArray[i];
            // get asset balance
            uint256 assetBalance = asset.asset.balanceOf(address(this));
            // multiply by actual price and add to the accumulated total currency
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
        if (address(priceProviderMap[assetAddress_]) != address(0)) revert AssetAlreadyWhitelisted();

        assetsArray.push(Asset({ asset: IERC20(assetAddress_), priceProvider: IPriceProvider(priceProviderAddress_) }));
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
     * @notice caller sends Asset and recipient address receives Collateral Token
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
