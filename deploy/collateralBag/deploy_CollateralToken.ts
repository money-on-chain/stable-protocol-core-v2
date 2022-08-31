import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployResult = await deploy("CollateralTokenCARBag", {
    contract: "MocRC20",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: ["CollateralToken", "CollateralToken"],
  });
  console.log(`MocRC20, as CollateralTokenCABag, deployed at ${deployResult.address}`);
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_CollateralTokenCARBag"; // id required to prevent reexecution
deployFunc.tags = ["CollateralTokenCARBag"];
