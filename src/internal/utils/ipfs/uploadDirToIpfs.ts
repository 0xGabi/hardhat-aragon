import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { globSource } from 'ipfs-http-client'
import path from 'path'

interface Cid {
  version: number
  codec: string
  multihash: Buffer
  multibaseName: string
  toString: () => string
}

interface IpfsAddResult {
  path: string
  size: number
  cid: Cid
}

/**
 * Uploads dist folder to IPFS
 * Applies various ignore patterns:
 * - .ipfsignore
 * - .gitignore
 */
export async function uploadDirToIpfs({
  dirPath,
  hre,
  ignore,
  progress
}: {
  dirPath: string
  hre: HardhatRuntimeEnvironment
  ignore?: string[]
  progress?: (totalBytes: number) => void
}): Promise<Cid> {
  const results: IpfsAddResult[] = []
  for await (const entry of hre.ipfs.add(
    globSource(dirPath, { recursive: true, ignore }),
    { progress }
  )) {
    results.push(entry)
  }

  // Warning! Infura does not allow uploading files with many files
  // - directory with 80 files of 10 bytes fails
  // - directory with 12 files of 46014 bytes fails
  // If that happens the list of results will not contain the last entry
  // with corresponds to the root directory, the hash we need
  const rootName = path.parse(dirPath).name
  const rootResult = results.find(r => r.path === rootName)
  if (!rootResult)
    throw Error(
      `root ${rootName} not found in results: \n${results
        .map(r => r.path)
        .join('\n')}`
    )
  return rootResult.cid
}
