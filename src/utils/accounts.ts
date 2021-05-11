import { HardhatRuntimeEnvironment } from 'hardhat/types'

/**
 * Returns the root or default account from a runtime environment
 * @param hre
 */
export async function getRootAccount(
  hre: HardhatRuntimeEnvironment
): Promise<string> {
  const from = hre.config.networks[hre.network.name].from

  return from || (await hre.web3.eth.getAccounts())[0]
}
