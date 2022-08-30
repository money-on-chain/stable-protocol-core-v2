import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployResult = await deploy("MocCABag", {
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
  });
  console.log(`MocCABag deployed at ${deployResult.address}`);

  return network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCABag"; // id required to prevent reexecution
deployFunc.tags = ["MocCABag"];
