import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployImplResult = await deploy("MocSettlementCARC20", {
    contract: "MocSettlement",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
  });
  console.log(`MocSettlementCARC20 implementation deployed at ${deployImplResult.address}`);

  const deployProxyResult = await deploy("MocSettlementCARC20Proxy", {
    contract: "ERC1967Proxy",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: [deployImplResult.address, "0x"],
  });
  console.log(`MocSettlementCARC20 ERC1967Proxy deployed at ${deployProxyResult.address}`);

  return network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocSettlementCARC20"; // id required to prevent re-execution
deployFunc.tags = ["MocSettlementCARC20"];
