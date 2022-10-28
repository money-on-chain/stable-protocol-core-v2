pragma solidity 0.8.17;

import "../../interfaces/IChangeContract.sol";
import "../../interfaces/IMocRC20.sol";
import "../../core/MocCore.sol";

/**
  @title EditPeggedTokenChangerTemplate
  @notice This contract is a ChangeContract intended to be used with Moc Aeropulus 
  governance system. It allows the edition of an existent Pegged Token to the system.
 */
contract EditPeggedTokenChangerTemplate is IChangeContract, MocHelper, Initializable {
    // ------- Storage -------

    MocCore public mocCore;
    IMocRC20 public tpToEdit;
    MocCore.PeggedTokenParams internal peggedTokenParams;

    /** 
    @notice Constructor
    @param mocCore_ Address of the contract to add Pegged Token to
  */
    constructor(MocCore mocCore_, IMocRC20 tpToEdit_) {
        mocCore = mocCore_;
        tpToEdit = tpToEdit_;

        (, bool exists) = mocCore.peggedTokenIndex(address(tpToEdit));
        if (!exists) revert InvalidAddress();
    }

    // ------- Initializer -------

    /**
     * @notice contract initializer
     * @param priceProvider_  new pegged token price provider
     */
    function setPriceProvider(address priceProvider_) external initializer {
        (uint8 i, ) = mocCore.peggedTokenIndex(address(tpToEdit));
        (, uint256 emaSf) = mocCore.tpEma(i);
        (, uint256 tiMin, uint256 tiMax) = mocCore.tpInterestRate(i);
        (int256 abeq, int256 facMinSubOne, int256 facMax) = mocCore.tpFAC(i);

        // Only edits the priceProvider, all the other values are taken from the contracts itself
        peggedTokenParams = MocCore.PeggedTokenParams(
            address(tpToEdit), // tpTokenAddress
            priceProvider_, // priceProviderAddress
            // Pegged Token target coverage [PREC]
            mocCore.tpCtarg(i),
            // Pegged Token reserve factor [PREC]
            mocCore.tpR(i),
            // Pegged Token minimum amount of blocks until the settlement to charge interest for redeem [N]
            mocCore.tpBmin(i),
            // fee pct sent to Fee Flow for mint [PREC]
            mocCore.tpMintFee(i),
            // fee pct sent to Fee Flow for redeem [PREC]
            mocCore.tpRedeemFee(i),
            // Emma is not editable, only initialized
            0,
            // Pegged Token smoothing factor [PREC]
            emaSf,
            // Pegged Token initial interest rate (tpTils), not editable, only initialized
            0,
            // Pegged Token minimum interest rate that can be charged
            tiMin,
            // Pegged Token maximum interest rate that can be charged
            tiMax,
            // abundance of Pegged Token where it is desired that the model stabilizes
            abeq,
            // Pegged Token minimum correction factor for interest rate
            facMinSubOne + int256(ONE),
            // Pegged Token maximum correction factor for interest rate
            facMax
        );
    }

    /**
    @notice Execute the changes.
    @dev Should be called by the governor, but this contract does not check that explicitly
    because it is not its responsibility in the current architecture
   */
    function execute() external {
        mocCore.addPeggedToken(peggedTokenParams);
    }
}
