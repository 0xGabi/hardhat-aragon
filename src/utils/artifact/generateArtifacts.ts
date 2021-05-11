import path from 'path'
import { TASK_FLATTEN_GET_FLATTENED_SOURCE } from 'hardhat/builtin-tasks/task-names'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { artifactName, manifestName, flatCodeName } from '~/src/params'
import { AragonManifest, AbiItem } from '~/src/types'
import {
  getMainContractName,
  readArapp,
  parseAppName
} from '~/src/utils/arappUtils'
import { readJson, writeJson, writeFile, ensureDir } from '~/src/utils/fsUtils'
import { generateAragonArtifact } from './generateAragonArtifact'

/**
 * Generate and write aragon artifacts to outPath
 * - artifact
 * - manifest
 * - flatCode
 * @param outPath "dist"
 * @param hre
 */
export async function generateArtifacts(
  outPath: string,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const arapp = readArapp()
  const appName = parseAppName(arapp, hre.network.name)
  const manifest = readJson<AragonManifest>(manifestName)
  const contractName: string = getMainContractName()

  // buidler will detect and throw for cyclic dependencies
  // any flatten task also compiles
  const flatCode = await hre.run(TASK_FLATTEN_GET_FLATTENED_SOURCE)
  // Get ABI from generated artifacts in compilation
  const abi = _readArtifact(contractName, hre).abi

  const artifact = generateAragonArtifact(
    arapp,
    appName,
    abi,
    flatCode,
    contractName
  )
  ensureDir(outPath)
  writeJson(path.join(outPath, artifactName), artifact)
  writeJson(path.join(outPath, manifestName), manifest)
  writeFile(path.join(outPath, flatCodeName), flatCode)
}

interface HardhatArtifact {
  contractName: string
  abi: AbiItem[]
  bytecode: string
  deployedBytecode: string
  linkReferences: {}
  deployedLinkReferences: {}
}

/**
 * Internal util to type and encapsulate interacting with artifacts
 * @param contractName "Counter"
 * @param hre
 */
function _readArtifact(
  contractName: string,
  hre: HardhatRuntimeEnvironment
): HardhatArtifact {
  return hre.artifacts.require(contractName)
}
