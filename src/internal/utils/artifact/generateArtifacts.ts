import path from 'path'
import { TASK_FLATTEN_GET_FLATTENED_SOURCE } from 'hardhat/builtin-tasks/task-names'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import {
  ARTIFACT_NAME,
  FLAT_CODE_NAME,
  MANIFEST_NAME
} from '../../../constants'
import { AragonManifest } from '../../../types'
import { readJson, writeJson, writeFile, ensureDir } from '../fsUtils'

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
  const { appEnsName, appContractName } = hre.config.aragon

  const manifest = readJson<AragonManifest>(MANIFEST_NAME)

  // hardhat will detect and throw for cyclic dependencies
  // any flatten task also compiles
  const flatCode = await hre.run(TASK_FLATTEN_GET_FLATTENED_SOURCE)
  // Get ABI from generated artifacts in compilation
  const contractArtifact = await hre.artifacts.readArtifact(appContractName)

  const aragonArtifact = generateAragonArtifact(
    appEnsName,
    contractArtifact.abi,
    flatCode,
    appContractName,
    hre
  )
  ensureDir(outPath)
  writeJson(path.join(outPath, ARTIFACT_NAME), aragonArtifact)
  writeJson(path.join(outPath, MANIFEST_NAME), manifest)
  writeFile(path.join(outPath, FLAT_CODE_NAME), flatCode)
}
