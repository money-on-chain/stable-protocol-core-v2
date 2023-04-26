// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { IChangeContract } from "../../interfaces/IChangeContract.sol";
import { MocCAWrapper, IPriceProvider } from "../../collateral/collateralBag/MocCAWrapper.sol";
import { IERC20, IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
  @title AddCAWrapperAssetChangerTemplate
  @notice This contract is a ChangeContract intended to be used with Moc Aeropulus 
  governance system. It allows the addition of a new Asset to the MocCAWrapper.
 */
contract AddCAWrapperAssetChangerTemplate is IChangeContract {
    error InvalidAssetDecimals();
    // ------- Storage -------

    // target contract
    MocCAWrapper public immutable mocCAWrapper;

    // Change params
    IERC20 public immutable asset;
    IPriceProvider public immutable priceProvider;

    /** 
    @notice Constructor
    @param mocCAWrapper_ Address of the contract to add the new Asset
    @param asset_ new asset address
    @param priceProvider_ priceProvider for this asset
  */
    constructor(MocCAWrapper mocCAWrapper_, IERC20 asset_, IPriceProvider priceProvider_) {
        if (IERC20Metadata(address(asset_)).decimals() > 18) revert InvalidAssetDecimals();
        mocCAWrapper = mocCAWrapper_;
        asset = asset_;
        priceProvider = priceProvider_;
    }

    /**
    @notice Execute the changes.
    @dev Should be called by the governor, but this contract does not check that explicitly
    because it is not its responsability in the current architecture
   */
    function execute() external {
        mocCAWrapper.addOrEditAsset(asset, priceProvider, IERC20Metadata(address(asset)).decimals());
    }
}
