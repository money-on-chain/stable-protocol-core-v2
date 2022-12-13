pragma solidity ^0.8.17;

import "../collateral/collateralBag/MocCAWrapper.sol";
import "./EchidnaMocCoreTester.sol";
import "../utils/PriceProviderShifter.sol";

contract EchidnaMocWrapperTester is EchidnaMocCoreTester {
    uint256 internal constant MAX_ASSETS = 5;

    MocCAWrapper internal mocWrapper;

    ERC20Mock[] internal assetsAdded;

    constructor() payable EchidnaMocCoreTester() {
        mocWrapper = MocCAWrapper(_deployProxy(address(new MocCAWrapper())));
        mocWrapper.initialize(address(governor), msg.sender, address(mocCARC20), address(acToken));
        // start with 0 total supply
        acToken.burn(acToken.balanceOf(address(this)));

        addAsset(18);
        addAsset(6);
    }

    function addAsset(uint8 decimals_) public {
        require(assetsAdded.length < MAX_ASSETS, "max assets already added");
        ERC20Mock asset = new ERC20Mock();
        // max decimals considered is 24
        uint8 decimals = decimals_ % 24;
        asset.setDecimals(decimals);

        mocWrapper.addOrEditAsset(asset, new PriceProviderShifter(new PriceProviderMock(1 ether), int8(18 - decimals)));
        assetsAdded.push(asset);
    }

    // we don´t need execute child mintTC function
    function mintTC(uint256 qTC_, uint256 qACmax_) public override {}

    function mintTC(uint8 assetIndex_, uint256 qTC_) public {
        ERC20Mock asset = assetsAdded[assetIndex_ % assetsAdded.length];
        asset.mint(address(this), qTC_ * 2);
        asset.approve(address(mocWrapper), qTC_ * 2);
        mocWrapper.mintTC(address(asset), qTC_, qTC_ * 2);
    }

    function redeemTC(uint8 assetIndex_, uint256 qTC_) public {
        ERC20Mock asset = assetsAdded[assetIndex_ % assetsAdded.length];
        mocCARC20.tcToken().approve(address(mocWrapper), qTC_);
        mocWrapper.redeemTC(address(asset), qTC_, 0);
    }

    function echidna_wrappedTokenPrice_always_ONE() public view returns (bool) {
        return mocWrapper.getTokenPrice() == PRECISION;
    }
}
