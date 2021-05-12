import { utils } from 'ethers'

export interface PinningService {
  name: string
  endpoint: string
  key: string
}

export interface IpfsConfig {
  url: string
  pinning?: PinningService
}

export interface AragonConfig {
  appEnsName: string
  appContractName: string
  appSrcPath: string
  appBuildOutputPath: string
  appBuildScript: string
  ignoreFilesPath: string
}

export interface AragonUserConfig {
  appEnsName: string
  appContractName: string
  appSrcPath?: string
  appBuildOutputPath?: string
  appBuildScript?: string
  ignoreFilesPath?: string
}

export interface Role {
  name: string // 'Create new payments'
  id: string // 'CREATE_PAYMENTS_ROLE'
  params: string[] //  ['Token address', ... ]
  bytes: string // '0x5de467a460382d13defdc02aacddc9c7d6605d6d4e0b8bd2f70732cae8ea17bc'
}

// The aragon manifest requires the use of camelcase for some names
/* eslint-disable camelcase */
export interface AragonManifest {
  name: string // 'Counter'
  author: string // 'Aragon Association'
  description: string // 'An application for Aragon'
  changelog_url: string // 'https://github.com/aragon/aragon-apps/releases',
  details_url: string // '/meta/details.md'
  source_url: string // 'https://<placeholder-repository-url>'
  icons: {
    src: string // '/meta/icon.svg'
    sizes: string // '56x56'
  }[]
  screenshots: {
    src: string // '/meta/screenshot-1.png'
  }[]
  script: string // '/script.js'
  start_url: string // '/index.html'
}
/* eslint-enable camelcase */

export interface AragonArtifactFunction {
  roles: string[]
  sig: string
  /**
   * This field might not be able if the contract does not use
   * conventional solidity syntax and Aragon naming standards
   * null if there in no notice
   */
  notice: string | null
  /**
   * The function's ABI element is included for convenience of the client
   * null if ABI is not found for this signature
   */
  abi: utils.Fragment | null
}

export interface AragonArtifact extends AragonAppJson {
  roles: Role[]
  abi: utils.Fragment[]
  /**
   * All publicly accessible functions
   * Includes metadata needed for radspec and transaction pathing
   * initialize() function should also be included for completeness
   */
  functions: AragonArtifactFunction[]
  /**
   * Functions that are no longer available at `version`
   */
  deprecatedFunctions: {
    [version: string]: AragonArtifactFunction[]
  }
  /**
   * The flaten source code of the contracts must be included in
   * any type of release at this path
   */
  flattenedCode: string // "./code.sol"
  appId: string
  appName: string

  // env: AragonEnvironment // DEPRECATED
  // deployment: any // DEPRECATED
  // path: string // DEPRECATED 'contracts/Finance.sol'
  // environments: AragonEnvironments // DEPRECATED
}

export interface AragonAppJson {
  roles: Role[]
  environments: AragonEnvironments
  path: string
  dependencies?: {
    appName: string // 'vault.aragonpm.eth'
    version: string // '^4.0.0'
    initParam: string // '_vault'
    state: string // 'vault'
    requiredPermissions: {
      name: string // 'TRANSFER_ROLE'
      params: string // '*'
    }[]
  }[]
  /**
   * If the appName is different per network use environments
   * ```ts
   * environments: {
   *   rinkeby: {
   *     appName: "myapp.open.aragonpm.eth"
   *   }
   * }
   * ```
   */
  appName?: string
}

export interface AragonEnvironments {
  [environmentName: string]: AragonEnvironment
}

export interface AragonEnvironment {
  network: string
  registry?: string
  appName?: string
  gasPrice?: string
  wsRPC?: string
  appId?: string
}
