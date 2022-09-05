import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployImplResult = await deploy("MocCACoinbaseImpl", {
    contract: "MocCACoinbase",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
  });
  console.log(`MocCACoinbase implementation deployed at ${deployImplResult.address}`);

  const deployProxyResult = await deploy("MocCACoinbaseProxy", {
    contract: "ERC1967Proxy",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: [deployImplResult.address, "0x"],
  });
  console.log(`MocCACoinbase ERC1967Proxy deployed at ${deployProxyResult.address}`);

  return network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCACoinbase"; // id required to prevent re-execution
deployFunc.tags = ["MocCACoinbase"];
