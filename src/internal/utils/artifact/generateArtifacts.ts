import { TASK_FLATTEN_GET_FLATTENED_SOURCE } from 'hardhat/builtin-tasks/task-names'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { MANIFEST_NAME } from '../../../constants'
import { AragonManifest, RepoContent } from '../../../types'
import { readJson } from '../fsUtils'

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
  hre: HardhatRuntimeEnvironment
): Promise<RepoContent> {
  const {
    appEnsName,
    appContractName,
    appRoles,
    appDependencies,
  } = hre.config.aragon

  // Get ABI from generated artifacts in compilation
  const { abi } = await hre.artifacts.readArtifact(appContractName)

  // hardhat will detect and throw for cyclic dependencies
  // any flatten task also compiles
  const flatCode = await hre.run(TASK_FLATTEN_GET_FLATTENED_SOURCE)

  const aragonArtifact = generateAragonArtifact(
    appEnsName,
    appContractName,
    appRoles,
    appDependencies,
    abi,
    flatCode
  )

  const manifest = readJson<AragonManifest>(MANIFEST_NAME)

  return { artifact: aragonArtifact, manifest, flatCode }
}
