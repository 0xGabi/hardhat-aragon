import { HardhatRuntimeEnvironment, HttpNetworkConfig } from 'hardhat/types'
import { ethers } from 'ethers'

/**
 * Resolve ENS name with custom ensAddress
 * @param name
 * @param hre
 * @param customEnsAddress
 */
export async function resolveName(
  {
    name,
    ensAddress
  }: {
    name: string
    ensAddress: string
  },
  hre: HardhatRuntimeEnvironment
): Promise<string | undefined> {
  const networkConfig = hre.network.config as HttpNetworkConfig

  const provider = new ethers.providers.Web3Provider(hre.web3.currentProvider, {
    name: hre.network.name,
    chainId: networkConfig.chainId || 5555,
    ensAddress
  })
  return provider.resolveName(name)
}
