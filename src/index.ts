import { extendConfig, extendEnvironment, task } from 'hardhat/config'
import { lazyObject } from 'hardhat/plugins'
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types'
import path from 'path'

import { ExampleHardhatRuntimeEnvironmentField } from './ExampleHardhatRuntimeEnvironmentField'
// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import './type-extensions'

export const TASK_PUBLISH = 'publish'

function normalizePath(
  config: HardhatConfig,
  userPath: string | undefined,
  defaultPath: string
): string {
  if (userPath === undefined) {
    userPath = path.join(config.paths.root, defaultPath)
  } else {
    if (!path.isAbsolute(userPath)) {
      userPath = path.normalize(path.join(config.paths.root, userPath))
    }
  }
  return userPath
}

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    config.paths.dist = normalizePath(config, userConfig.paths?.dist, 'dist')
  }
)

extendEnvironment(hre => {
  // We add a field to the Hardhat Runtime Environment here.
  // We use lazyObject to avoid initializing things until they are actually
  // needed.
  hre.example = lazyObject(() => new ExampleHardhatRuntimeEnvironmentField())
})

task(TASK_PUBLISH, 'Publish a new app version')
  .addPositionalParam(
    'bump',
    'Type of bump (major, minor or patch) or semantic version',
    undefined,
    types.string
  )
  .addOptionalParam(
    'contract',
    'Contract address previously deployed.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'managerAddress',
    'Owner of the APM repo. Must be provided in the initial release',
    undefined,
    types.string
  )
  .addOptionalParam(
    'ipfsApiUrl',
    'IPFS API URL to connect to an ipfs daemon API server',
    'http://localhost:5001',
    types.string
  )
  .addFlag(
    'onlyContent',
    'Prevents contract compilation, deployment and artifact generation.'
  )
  .addFlag('skipValidation', 'Skip validation of artifacts files.')
  .addFlag('dryRun', 'Output tx data without broadcasting')
  .setAction(
    async (
      params,
      hre: HardhatRuntimeEnvironment
    ): Promise<apm.PublishVersionTxData> => {
      // Do param type verification here and call publishTask with clean params
      return await publishTask(
        {
          bumpOrVersion: params.bump,
          existingContractAddress: params.contract,
          managerAddress: params.managerAddress,
          ipfsApiUrl: params.ipfsApiUrl,
          onlyContent: params.onlyContent,
          skipValidation: params.skipValidation,
          dryRun: params.dryRun
        },
        hre
      )
    }
  )
