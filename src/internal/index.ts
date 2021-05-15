import execa from 'execa'
import path from 'path'
import { providers } from 'ethers'
import { extendConfig, extendEnvironment, task } from 'hardhat/config'
import { HardhatPluginError, lazyObject } from 'hardhat/plugins'
import {
  HardhatConfig,
  HardhatUserConfig,
  HttpNetworkConfig,
} from 'hardhat/types'
import * as types from 'hardhat/internal/core/params/argumentTypes'

import {
  DEFAULT_APP_BUILD_PATH,
  DEFAULT_APP_SRC_PATH,
  DEFAULT_IGNORE_PATH,
  DEFAULT_IPFS_API_ENDPOINT,
  DEFAULT_IPFS_GATEWAY,
  DEFAULT_APP_BUILD_SCRIPT,
  EXPLORER_CHAIN_URLS,
} from '../constants'
import { RepoContent } from '../types'
import { TASK_PUBLISH } from './task-names'

import { log } from './ui/logger'
import * as apm from './utils/apm'
import { pinContent } from './utils/ipfs/pinContent'
import {
  generateArtifacts,
  validateArtifacts,
  writeArtifacts,
} from './utils/artifact'
import createIgnorePatternFromFiles from './utils/createIgnorePatternFromFiles'
import parseAndValidateBumpOrVersion from './utils/parseAndValidateBumpOrVersion'
import {
  getPrettyPublishTxPreview,
  getPublishTxOutput,
} from './utils/prettyOutput'
import { pathExists } from './utils/fsUtils'
import {
  uploadDirToIpfs,
  assertIpfsApiIsAvailable,
  guessGatewayUrl,
  assertUploadContetResolve,
} from './utils/ipfs'

// We ommit these imports beacuse they are peer dependencies and will be added
// by the plugin user. Otherwise naming conflicts may araise
// import '@nomiclabs/hardhat-ethers'
// import 'hardhat-deploy'

// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import './type-extensions'

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    config.ipfs = {
      url: userConfig.ipfs?.url ?? DEFAULT_IPFS_API_ENDPOINT,
      gateway: userConfig.ipfs?.gateway ?? DEFAULT_IPFS_GATEWAY,
      pinata: userConfig.ipfs?.pinata,
    }

    config.aragon = {
      appEnsName: userConfig.aragon.appEnsName,
      appContractName: userConfig.aragon.appContractName,
      appRoles: userConfig.aragon.appRoles ?? [],
      appDependencies: userConfig.aragon.appDependencies ?? [],
      appSrcPath: path.normalize(
        path.join(
          config.paths.root,
          userConfig.aragon.appSrcPath ?? DEFAULT_APP_SRC_PATH
        )
      ),
      appBuildOutputPath: path.normalize(
        path.join(
          config.paths.root,
          userConfig.aragon.appBuildOutputPath ?? DEFAULT_APP_BUILD_PATH
        )
      ),
      appBuildScript:
        userConfig.aragon.appBuildScript ?? DEFAULT_APP_BUILD_SCRIPT,
      ignoreFilesPath: path.normalize(
        path.join(
          config.paths.root,
          userConfig.aragon.ignoreFilesPath ?? DEFAULT_IGNORE_PATH
        )
      ),
    }
  }
)

extendEnvironment((hre) => {
  hre.ipfs = lazyObject(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { create } = require('ipfs-http-client')

    let url
    try {
      url = new URL(hre.config.ipfs.url)
    } catch (e) {
      throw new HardhatPluginError(`Invalid IPFS URL: ${hre.config.ipfs.url}
The IPFS URL must be of the following format: http(s)://host[:port]/[path]`)
    }

    return create({
      protocol: url.protocol.replace(/[:]+$/, ''),
      host: url.hostname,
      port: url.port,
      'api-path': url.pathname.replace(/\/$/, '') + '/api/v0/',
    })
  })
})

task(TASK_PUBLISH, 'Publish a new app version to Aragon Package Manager')
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
  .addOptionalVariadicPositionalParam(
    'constructorArgs',
    'Constructor arguments for the app contract.',
    []
  )
  .addFlag(
    'onlyContent',
    'Prevents contract compilation, deployment, and artifact generation.'
  )
  .addFlag('skipAppBuild', 'Skip application build.')
  .addFlag('skipValidation', 'Skip validation of artifacts files.')
  .addFlag('dryRun', 'Output tx data without broadcasting')
  .setAction(
    async (args, hre): Promise<apm.PublishVersionTxData> => {
      const [owner] = await hre.ethers.getSigners()

      // Do param type verification here and call publishTask with clean params
      const bumpOrVersion = args.bump
      const existingContractAddress = args.contract
      const {
        appEnsName,
        appContractName,
        appSrcPath,
        appBuildOutputPath,
        appBuildScript,
        ignoreFilesPath,
      } = hre.config.aragon

      // Prefer to use the appEnsName configured per network relevant
      // for apps that were deployed to diferent repo names
      const finalAppEnsName = hre.network.config.appEnsName ?? appEnsName

      // Setup provider with the right ENS registy address
      let provider
      if (hre.network.name === 'hardhat') {
        hre.ethers.provider.network.ensAddress = hre.network.config.ensRegistry
        provider = hre.ethers.provider
      } else {
        provider = new hre.ethers.providers.JsonRpcProvider(
          (hre.network.config as HttpNetworkConfig).url,
          {
            name: hre.network.name,
            ensAddress: hre.network.config.ensRegistry,
            chainId: parseInt(await hre.getChainId()),
          }
        )
      }

      const prevVersion = await _getLastestVersionIfExists(
        finalAppEnsName,
        provider
      )
      const { bump, nextVersion } = parseAndValidateBumpOrVersion(
        bumpOrVersion,
        prevVersion ? prevVersion.version : undefined
      )
      log(`Applying version bump ${bump}, next version: ${nextVersion}`)

      // Do sanity checks before compiling the contract or uploading files
      // So users do not have to wait a long time before seeing the config is not okay
      await apm.assertCanPublish(finalAppEnsName, owner.address, provider)

      const ipfs = hre.ipfs
      await assertIpfsApiIsAvailable(ipfs, hre.config.ipfs.url)

      // Using let + if {} block instead of a ternary operator
      // to assign value and log status to console
      let contractAddress: string
      if (args.onlyContent) {
        contractAddress = hre.ethers.constants.AddressZero
        log('No contract used for this version')
      } else if (existingContractAddress) {
        contractAddress = existingContractAddress
        log(`Using provided contract address: ${contractAddress}`)
      } else if (!prevVersion || bump === 'major') {
        log(
          'Deploying new implementation or reusing last deployment if no changes.'
        )
        const deployment = await hre.deployments.deploy(appContractName, {
          from: owner.address,
          args: args.constructorArgs,
          log: true,
          deterministicDeployment: true,
          gasLimit:
            hre.network.config.gas === 'auto'
              ? undefined
              : hre.network.config.gas,
        })
        contractAddress = deployment.address
        log(`New implementation contract address: ${contractAddress}`)
      } else {
        contractAddress = prevVersion.contractAddress
        log(`Reusing previous version contract address: ${contractAddress}`)
      }

      if (!args.skipAppBuild && pathExists(appSrcPath)) {
        log(`Running app build script...`)
        try {
          await execa('npm', ['run', appBuildScript], {
            cwd: appSrcPath,
          })
        } catch (e) {
          throw new HardhatPluginError(
            `Make sure the app dependencies were installed`
          )
        }
      }

      if (!args.onlyContent) {
        let content: RepoContent
        if (prevVersion && bump !== 'major') {
          log(`Resolving Aragon artifacts from Aragon Package Manager`)
          content = await apm.resolveRepoContentUri(prevVersion.contentUri, {
            ipfsGateway: hre.config.ipfs.gateway,
          })
        } else {
          log(`Generating Aragon app artifacts`)
          content = await generateArtifacts(hre)
        }

        writeArtifacts(appBuildOutputPath, content)

        if (!args.skipValidation) {
          const hasFrontend = appSrcPath ? true : false
          validateArtifacts(appBuildOutputPath, appContractName, hasFrontend)
        }
      }

      // Upload release directory to IPFS
      log('Uploading release assets to IPFS...')
      const contentHash = await uploadDirToIpfs({
        dirPath: appBuildOutputPath,
        ipfs,
        ignore: createIgnorePatternFromFiles(ignoreFilesPath),
      })
      log(`Release assets uploaded to IPFS: ${contentHash}`)

      await assertUploadContetResolve(contentHash, hre.config.ipfs.gateway)

      if (hre.config.ipfs.pinata && hre.config.ipfs.pinata.key !== '') {
        log('Pinning content to pinata...')
        const response = await pinContent({
          contentHash,
          appEnsName: finalAppEnsName,
          version: nextVersion,
          network: hre.network.name,
          pinata: hre.config.ipfs.pinata,
        })
        if (response)
          log(`Content pinned:
    id: ${response.id}
    status: ${response.status}
    name: ${response.name}`)
      }

      // Generate tx to publish new app to aragonPM
      const versionInfo = {
        version: nextVersion,
        contractAddress,
        contentUri: apm.toContentUri('ipfs', contentHash),
      }

      const txData = await apm.publishVersion(
        finalAppEnsName,
        versionInfo,
        provider,
        {
          managerAddress: owner.address,
        }
      )

      const activeIpfsGateway = await guessGatewayUrl({
        ipfsApiUrl: hre.config.ipfs.url,
        ipfsGateway: hre.config.ipfs.gateway,
        contentHash,
      })

      log(
        getPrettyPublishTxPreview({
          txData,
          appName: finalAppEnsName,
          nextVersion,
          bump,
          contractAddress,
          contentHash,
          ipfsGateway: activeIpfsGateway || DEFAULT_IPFS_API_ENDPOINT,
        })
      )

      if (args.dryRun) {
        log(
          getPublishTxOutput.dryRun({
            txData,
            rootAccount: owner.address,
          })
        )
      } else {
        const tranactionResponse = await owner.sendTransaction({
          to: txData.to,
          data: apm.encodePublishVersionTxData(txData),
        })

        const { chainId } = await provider.getNetwork()
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        const explorerTxUrl = EXPLORER_CHAIN_URLS[chainId]

        log(getPublishTxOutput.txHash(tranactionResponse.hash, explorerTxUrl))

        const receipt = await tranactionResponse.wait()

        log(getPublishTxOutput.receipt(receipt))
      }

      // For testing
      return txData
    }
  )

/**
 * Returns latest version given a full app ENS name
 * Returns undefined if repo does not exists
 * @param appEnsName "finance.aragonpm.eth"
 * @param provider
 */
async function _getLastestVersionIfExists(
  appEnsName: string,
  provider: providers.Provider
): Promise<apm.ApmVersion | undefined> {
  // Check ENS name first since ethers causes an UnhandledPromiseRejectionWarning
  const repoAddress = await provider.resolveName(appEnsName)
  if (!repoAddress) return

  // Check for latest version but expect errors
  try {
    return await apm.getRepoVersion(repoAddress, 'latest', provider)
  } catch (e) {
    throw e
  }
}
