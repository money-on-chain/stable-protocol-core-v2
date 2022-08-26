import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployResult = await deploy("MocCARBag", {
    contract: "MocCARC20",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
  });
  console.log(`MocCARBag deployed at ${deployResult.address}`);

  return network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCARBag"; // id required to prevent reexecution
deployFunc.tags = ["MocCARBag"];
