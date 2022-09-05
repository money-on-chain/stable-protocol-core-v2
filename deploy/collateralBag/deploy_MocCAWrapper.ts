import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployResult = await deploy("MocCAWrapperImpl", {
    contract: "MocCAWrapper",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
  });
  console.log(`MocCAWrapper Implementation deployed at ${deployResult.address}`);

  const deployProxyResult = await deploy("MocCAWrapperProxy", {
    contract: "ERC1967Proxy",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: [deployResult.address, "0x"],
  });
  console.log(`MocCAWrapper ERC1967Proxy deployed at ${deployProxyResult.address}`);

  return network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCAWrapper"; // id required to prevent re-execution
deployFunc.tags = ["MocCAWrapper"];
