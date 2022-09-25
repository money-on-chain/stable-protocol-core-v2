pragma solidity 0.8.16;

import "../../interfaces/IChangeContract.sol";
import "../../core/MocCore.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
  @title AddPeggedTokenChangerTemplate
  @notice This contract is a ChangeContract intended to be used with Moc Aeropulus 
  governance system. It allows the addition of a new Pegged Token to the system.
 */
contract AddPeggedTokenChangerTemplate is IChangeContract, Initializable, Ownable {
    // ------- Structs -------

    // AddPeggedTokenParams is broke down in two, to avoid stack to deep error
    struct AddPeggedTokenParams1 {
        // Pegged Token contract address to add
        address tpTokenAddress;
        // priceProviderAddress Pegged Token price provider contract address
        address priceProviderAddress;
        // Pegged Token reserve factor [PREC]
        uint256 tpR;
        // Pegged Token minimum amount of blocks until the settlement to charge interest for redeem [N]
        uint256 tpBmin;
        // fee pct sent to Fee Flow for mint [PREC]
        uint256 tpMintFee;
        // fee pct sent to Fee Flow for redeem [PREC]
        uint256 tpRedeemFee;
        // initial Pegged Token exponential moving average [PREC]
        uint256 tpEma;
        // Pegged Token smoothing factor [PREC]
        uint256 tpEmaSf;
        // Pegged Token initial interest rate
        uint256 tpTils;
        // Pegged Token minimum interest rate that can be charged
        uint256 tpTiMin;
        // Pegged Token maximum interest rate that can be charged
        uint256 tpTiMax;
        // abundance of Pegged Token where it is desired that the model stabilizes
        int256 tpAbeq;
    }
    struct AddPeggedTokenParams2 {
        // Pegged Token minimum correction factor for interest rate
        int256 tpFacMin;
        // Pegged Token maximum correction factor for interest rate
        int256 tpFacMax;
    }

    // ------- Storage -------

    MocCore public mocCore;
    AddPeggedTokenParams1 public addPeggedTokenParams1;
    AddPeggedTokenParams2 public addPeggedTokenParams2;

    /** 
    @notice Constructor
    @param mocCore_ Address of the contract to add Pegged Token to
  */
    constructor(MocCore mocCore_) {
        mocCore = mocCore_;
    }

    /**
     * @dev This couldn't go on the contructor as it doesn't allow calldata,
     * and it's needed to avoid stack too deep issue.
     */
    function initialize(
        AddPeggedTokenParams1 calldata addPeggedTokenParams1_,
        AddPeggedTokenParams2 calldata addPeggedTokenParams2_
    ) external initializer onlyOwner {
        addPeggedTokenParams1 = addPeggedTokenParams1_;
        addPeggedTokenParams2 = addPeggedTokenParams2_;
    }

    /**
    @notice Execute the changes.
    @dev Should be called by the governor, but this contract does not check that explicitly
    because it is not its responsability in the current architecture
    IMPORTANT: This function should not be overriden, you should only redefine
    _beforeUpgrade and _afterUpgrade methods to use this template
   */
    function execute() external {
        MocCore.AddPeggedTokenParams memory params = MocCore.AddPeggedTokenParams(
            addPeggedTokenParams1.tpTokenAddress,
            addPeggedTokenParams1.priceProviderAddress,
            addPeggedTokenParams1.tpR,
            addPeggedTokenParams1.tpBmin,
            addPeggedTokenParams1.tpMintFee,
            addPeggedTokenParams1.tpRedeemFee,
            addPeggedTokenParams1.tpEma,
            addPeggedTokenParams1.tpEmaSf,
            addPeggedTokenParams1.tpTils,
            addPeggedTokenParams1.tpTiMin,
            addPeggedTokenParams1.tpTiMax,
            addPeggedTokenParams1.tpAbeq,
            addPeggedTokenParams2.tpFacMin,
            addPeggedTokenParams2.tpFacMax
        );
        bytes memory data = abi.encodeWithSignature(
            // solhint-disable-next-line max-line-length
            "addPeggedToken((address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,int256,int256,int256))",
            params
        );
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = address(mocCore).call(data);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        }
    }
}
