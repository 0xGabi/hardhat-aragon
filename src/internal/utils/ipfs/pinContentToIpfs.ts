import { PinningService } from '../../../types'

interface Cid {
  version: number
  codec: string
  multihash: Buffer
  multibaseName: string
  toString: () => string
}

async function addPinningServices(
  ipfs: any,
  pinning: PinningService
): Promise<void> {
  // const exitingServices = await hre.ipfs.pin.remote.service.ls()

  await ipfs.pin.remote.sevice.add(pinning.name, {
    endpoint: new URL(pinning.endpoint),
    key: pinning.key
  })
}

/**
 * Uploads dist folder to IPFS
 * Applies various ignore patterns:
 * - .ipfsignore
 * - .gitignore
 */
export async function pinContentToIpfs({
  ipfs,
  pinning,
  cid,
  name
}: {
  ipfs: any
  pinning: PinningService
  cid: Cid
  name: string
}): Promise<string> {
  await addPinningServices(ipfs, pinning)
  const pin = await ipfs.pin.remote.add(cid, {
    service: pinning.name,
    name
  })
  return pin.toString()
}
