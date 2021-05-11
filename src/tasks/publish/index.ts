import { ethers } from 'ethers'
import execa from 'execa'
import { task, types } from 'hardhat/config'
import { HardhatPluginError } from 'hardhat/plugins'
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from 'hardhat/types'
import {
  ZERO_ADDRESS,
  etherscanSupportedChainIds,
  defaultIpfsGateway,
  etherscanChainUrls
} from '~/src/params'
import {
  TASK_COMPILE,
  TASK_VERIFY_CONTRACT,
  TASK_PUBLISH
} from '~/src/tasks/task-names'
import { AragonConfig } from '~/src/types'
import { logMain } from '~/src/ui/logger'
import * as apm from '~/src/utils/apm'
import { getRootAccount } from '~/src/utils/accounts'
import { getFullAppName } from '~/src/utils/appName'
import {
  getMainContractName,
  readArapp,
  parseAppName
} from '~/src/utils/arappUtils'
import { generateArtifacts, validateArtifacts } from '~/src/utils/artifact'
import {
  uploadDirToIpfs,
  assertIpfsApiIsAvailable,
  guessGatewayUrl
} from '~/src/utils/ipfs'
import createIgnorePatternFromFiles from './createIgnorePatternFromFiles'
import parseAndValidateBumpOrVersion from './parseAndValidateBumpOrVersion'
import { getPrettyPublishTxPreview, getPublishTxOutput } from './prettyOutput'

/**
 * Sets up the publish task
 * Note: Tasks must be setup in a function. If task() is run in the
 * module body on test teardown, they will not be setup again
 */
export function setupPublishTask(): void {
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
}

async function publishTask(
  {
    bumpOrVersion,
    existingContractAddress,
    managerAddress,
    ipfsApiUrl: ipfsApiUrlArg,
    onlyContent,
    skipValidation,
    dryRun
  }: {
    bumpOrVersion: string
    existingContractAddress: string
    managerAddress: string
    ipfsApiUrl: string
    onlyContent: boolean
    skipValidation: boolean
    dryRun: boolean
  },
  hre: HardhatRuntimeEnvironment
): Promise<apm.PublishVersionTxData> {
  const aragonConfig = hre.config.aragon as AragonConfig
  const appSrcPath = aragonConfig.appSrcPath as string
  const distPath = aragonConfig.appBuildOutputPath as string
  const ignoreFilesPath = aragonConfig.ignoreFilesPath as string
  const selectedNetwork = hre.network.name
  const ipfsApiUrl = ipfsApiUrlArg || (hre.config.aragon || {}).ipfsApi

  // TODO: Warn the user their metadata files (e.g. appName) are not correct.

  const arapp = readArapp()
  const appName = parseAppName(arapp, selectedNetwork)
  const contractName = getMainContractName()
  const rootAccount = await getRootAccount(hre)

  // Initialize clients
  const networkConfig = hre.network.config as HttpNetworkConfig

  const signers = 
  const provider = new ethers.providers.JsonRpcProvider(
    hre.web3.currentProvider,
    networkConfig.ensAddress && {
      name: hre.network.name,
      chainId: networkConfig.chainId || 5555,
      ensAddress: networkConfig.ensAddress
    }
  )

  const prevVersion = await _getLastestVersionIfExists(appName, provider)

  const { bump, nextVersion } = parseAndValidateBumpOrVersion(
    bumpOrVersion,
    prevVersion ? prevVersion.version : undefined
  )
  logMain(`Applying version bump ${bump}, next version: ${nextVersion}`)

  // Do sanity checks before compiling the contract or uploading files
  // So users do not have to wait a long time before seeing the config is not okay
  await apm.assertCanPublish(appName, rootAccount, provider)
  if (!ipfsApiUrl)
    throw new HardhatPluginError(
      `No IPFS API url configured. Add 'aragon.ipfsApiUrl' to your buidler.config with
a valid IPFS API url that you have permissions to upload and persist content to.
Example values:

    http://your-remote-node.io:5001
    https://ipfs.infura.io

Note: if you are releasing this app in production, you are responsible for pinning
the app's content and making sure it's available to users.

If you want to quickly test an app release and you are not concerned about persistance,
you may use a public IPFS API such as

    https://ipfs.infura.io
`
    )
  await assertIpfsApiIsAvailable(ipfsApiUrl)

  // Using let + if {} block instead of a ternary operator
  // to assign value and log status to console
  let contractAddress: string
  if (onlyContent) {
    contractAddress = ZERO_ADDRESS
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

  if (appSrcPath) {
    logMain(`Running app build script`)
    await execa('npm', ['run', 'build'], { cwd: appSrcPath })
  }

  // Generate and validate Aragon artifacts, release files
  logMain(`Generating Aragon app artifacts`)
  await generateArtifacts(distPath, hre)
  const hasFrontend = appSrcPath ? true : false
  if (!skipValidation) validateArtifacts(distPath, hasFrontend)

  // Upload release directory to IPFS
  logMain('Uploading release assets to IPFS...')
  const contentHash = await uploadDirToIpfs({
    dirPath: distPath,
    ipfsApiUrl,
    ignore: createIgnorePatternFromFiles(ignoreFilesPath)
  })
  logMain(`Release assets uploaded to IPFS: ${contentHash}`)

  // Generate tx to publish new app to aragonPM
  const versionInfo = {
    version: nextVersion,
    contractAddress,
    contentUri: apm.toContentUri('ipfs', contentHash)
  }

  const network = await provider.getNetwork()
  if (!managerAddress) managerAddress = rootAccount
  const txData = await apm.publishVersion(appName, versionInfo, provider, {
    managerAddress
  })

  const ipfsGateway =
    (hre.config.aragon || {}).ipfsGateway || defaultIpfsGateway
  const activeIpfsGateway = await guessGatewayUrl({
    ipfsApiUrl,
    ipfsGateway,
    contentHash
  })

  logMain(
    getPrettyPublishTxPreview({
      txData,
      appName,
      nextVersion,
      bump,
      contractAddress,
      contentHash,
      ipfsGateway: activeIpfsGateway || ipfsGateway
    })
  )

  if (dryRun) {
    logMain(getPublishTxOutput.dryRun({ txData, rootAccount }))
  } else {
    const etherscanTxUrl = etherscanChainUrls[network.chainId]

    const receipt = await signer
      .sendTransaction({
        from: rootAccount,
        to: txData.to,
        data: apm.encodePublishVersionTxData(txData)
      })
      .on('transactionHash', (hash: string) => {
        logMain(getPublishTxOutput.txHash(hash, etherscanTxUrl))
      })
    logMain(getPublishTxOutput.receipt(receipt))
  }

  // For testing
  return txData
}

/**
 * Returns latest version given a partial or full appName
 * Returns undefined if repo does not exists
 * @param appName "finance" | "finance.aragonpm.eth"
 * @param provider
 */
async function _getLastestVersionIfExists(
  appName: string,
  provider: ethers.providers.Provider
): Promise<apm.ApmVersion | undefined> {
  const fullAppName = getFullAppName(appName)
  // Check ENS name first since ethers causes an UnhandledPromiseRejectionWarning
  const repoAddress = await provider.resolveName(fullAppName)
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
  const MainContract = hre.artifacts.require(contractName)
  const mainContract = await MainContract.new()
  logMain('Implementation contract deployed')
  return mainContract.address
}
