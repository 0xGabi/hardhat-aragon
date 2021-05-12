import { HardhatPluginError } from 'hardhat/plugins'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

/**
 * Sanity check to check if an IPFS API is active
 * Note: It requires the API to /api/v0/version route available
 */
export async function assertIpfsApiIsAvailable(
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  try {
    await hre.ipfs.version()
  } catch (e) {
    throw new HardhatPluginError(
      `IPFS API at ${hre.config.ipfs.url} is not available`
    )
  }
}
