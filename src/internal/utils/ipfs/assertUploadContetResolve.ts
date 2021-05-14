import { HardhatPluginError } from 'hardhat/plugins'

/**
 * Sanity check to check if an IPFS API is active
 * Note: It requires the API to /api/v0/version route available
 */
export async function assertIpfsApiIsAvailable(
  ipfs: any,
  url: string
): Promise<void> {
  try {
    await ipfs.version()
  } catch (e) {
    throw new HardhatPluginError(
      `IPFS API at ${url} is not available. Error: ${e}`
    )
  }
}
