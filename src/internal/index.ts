import execa from 'execa'
import path from 'path'
import { providers } from 'ethers'
import { extendConfig, extendEnvironment, task } from 'hardhat/config'
import { HardhatPluginError, lazyObject } from 'hardhat/plugins'
import {
  HardhatConfig,
  HardhatRuntimeEnvironment,
  HardhatUserConfig
} from 'hardhat/types'
import * as types from 'hardhat/internal/core/params/argumentTypes'

import {
  DEFAULT_APP_BUILD_PATH,
  DEFAULT_APP_SRC_PATH,
  DEFAULT_IGNORE_PATH,
  DEFAULT_IPFS_API_ENDPOINT,
  DEFAULT_IPFS_GATEWAY,
  DEFAULT_APP_BUILD_SCRIPT,
  EXPLORER_CHAIN_URLS
} from '../constants'
import { TASK_PUBLISH, TASK_COMPILE } from './task-names'

import { logMain } from './ui/logger'
import * as apm from './utils/apm'
import { generateArtifacts, validateArtifacts } from './utils/artifact'
import createIgnorePatternFromFiles from './utils/createIgnorePatternFromFiles'
import parseAndValidateBumpOrVersion from './utils/parseAndValidateBumpOrVersion'
import {
  getPrettyPublishTxPreview,
  getPublishTxOutput
} from './utils/prettyOutput'
import { pathExists } from './utils/fsUtils'
import {
  uploadDirToIpfs,
  assertIpfsApiIsAvailable,
  guessGatewayUrl
} from './utils/ipfs'

import '@nomiclabs/hardhat-ethers'

// This import is needed to let the TypeScript compiler know that it should include your type
// extensions in your npm package's types file.
import './type-extensions'
import { pinContentToIpfs } from './utils/ipfs/pinContentToIpfs'

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    config.ipfs = {
      url: userConfig.ipfs?.url ?? DEFAULT_IPFS_API_ENDPOINT,
      gateway: userConfig.ipfs?.gateway ?? DEFAULT_IPFS_GATEWAY,
      pinning: userConfig.ipfs?.pinning
    }

    config.aragon = {
      appEnsName: userConfig.aragon.appEnsName,
      appContractName: userConfig.aragon.appContractName,
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
      )
    }
  }
)

extendEnvironment(hre => {
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
      'api-path': url.pathname.replace(/\/$/, '') + '/api/v0/'
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
  .addFlag(
    'onlyContent',
    'Prevents contract compilation, deployment, and artifact generation.'
  )
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
        ignoreFilesPath
      } = hre.config.aragon

      const finalAppEnsName = hre.network.config.appEnsName ?? appEnsName
      const contractName = appContractName

      // Mutate provider with new ENS address
      if (hre.network.config.ensRegistry) {
        hre.ethers.provider.network.ensAddress = hre.network.config.ensRegistry
      }
      const provider = hre.ethers.provider

      const prevVersion = await _getLastestVersionIfExists(
        finalAppEnsName,
        provider
      )
      const { bump, nextVersion } = parseAndValidateBumpOrVersion(
        bumpOrVersion,
        prevVersion ? prevVersion.version : undefined
      )
      logMain(`Applying version bump ${bump}, next version: ${nextVersion}`)

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
        logMain('No contract used for this version')
      } else if (existingContractAddress) {
        contractAddress = existingContractAddress
        logMain(`Using provided contract address: ${contractAddress}`)
      } else if (!prevVersion || bump === 'major') {
        logMain('Deploying new implementation contract')
        contractAddress = await _deployMainContract(contractName, hre)
        logMain(`New implementation contract address: ${contractAddress}`)
      } else {
        contractAddress = prevVersion.contractAddress
        logMain(`Reusing previous version contract address: ${contractAddress}`)
      }

      // if (pathExists(appSrcPath)) {
      //   logMain(`Running app build script`)
      //   await execa('npm', ['run', appBuildScript], { cwd: appSrcPath })
      // }

      // Generate and validate Aragon artifacts, release files
      logMain(`Generating Aragon app artifacts`)
      await generateArtifacts(appBuildOutputPath, hre)
      const hasFrontend = appSrcPath ? true : false
      if (!args.skipValidation)
        validateArtifacts(appBuildOutputPath, hasFrontend)

      // Upload release directory to IPFS
      logMain('Uploading release assets to IPFS...')
      const cid = await uploadDirToIpfs({
        dirPath: appBuildOutputPath,
        ipfs,
        ignore: createIgnorePatternFromFiles(ignoreFilesPath)
      })
      const contentHash = cid.toString()
      logMain(`Release assets uploaded to IPFS: ${contentHash}`)

      if (hre.config.ipfs.pinning) {
        // Pin content to pinning services
        logMain('Pinning content...')
        const pin = await pinContentToIpfs({
          ipfs,
          pinning: hre.config.ipfs.pinning,
          cid,
          name: finalAppEnsName
        })
        logMain(
          `Content pinned to IPFS on ${hre.config.ipfs.pinning.name}: ${pin}`
        )
      }

      // Generate tx to publish new app to aragonPM
      const versionInfo = {
        version: nextVersion,
        contractAddress,
        contentUri: apm.toContentUri('ipfs', contentHash)
      }

      const txData = await apm.publishVersion(
        finalAppEnsName,
        versionInfo,
        provider,
        { managerAddress: owner.address }
      )

      const activeIpfsGateway = await guessGatewayUrl({
        ipfsApiUrl: DEFAULT_IPFS_API_ENDPOINT,
        ipfsGateway: DEFAULT_IPFS_API_ENDPOINT,
        contentHash
      })

      logMain(
        getPrettyPublishTxPreview({
          txData,
          appName: finalAppEnsName,
          nextVersion,
          bump,
          contractAddress,
          contentHash,
          ipfsGateway: activeIpfsGateway || DEFAULT_IPFS_API_ENDPOINT
        })
      )

      if (args.dryRun) {
        logMain(
          getPublishTxOutput.dryRun({
            txData,
            rootAccount: owner.address
          })
        )
      } else {
        const { chainId } = await provider.getNetwork()
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        const explorerTxUrl = EXPLORER_CHAIN_URLS[chainId]

        const tranactionResponse = await owner.sendTransaction({
          to: txData.to,
          data: apm.encodePublishVersionTxData(txData)
        })

        logMain(
          getPublishTxOutput.txHash(tranactionResponse.hash, explorerTxUrl)
        )

        const receipt = await tranactionResponse.wait()

        logMain(getPublishTxOutput.receipt(receipt))
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

/**
 * Deploys a new implementation contract and returns its address
 * @param contractName
 * @param verify
 * @param hre
 */
async function _deployMainContract(
  contractName: string,
  hre: HardhatRuntimeEnvironment
): Promise<string> {
  // Compile contracts
  await hre.run(TASK_COMPILE)
  // Deploy contract
  const factory = await hre.ethers.getContractFactory(contractName)
  const mainContract = await factory.deploy()
  logMain('Implementation contract deployed')
  return mainContract.address
}
