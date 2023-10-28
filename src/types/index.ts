import { utils } from 'ethers'

export interface PinataConfig {
  key: string
  secret: string
}

export interface IpfsUserConfig {
  url?: string
  gateway?: string
  pinata?: PinataConfig
}

export interface IpfsConfig {
  url: string
  gateway: string
  pinata?: PinataConfig
}

export interface Dependencies {
  appName: string // 'vault.aragonpm.eth'
  version: string // '^4.0.0'
  initParam: string // '_vault'
  state: string // 'vault'
  requiredPermissions: {
    name: string // 'TRANSFER_ROLE'
    params: string // '*'
  }[]
}
export interface Role {
  name: string // 'Create new payments'
  id: string // 'CREATE_PAYMENTS_ROLE'
  params: string[] //  ['Token address', ... ]
}

export interface AragonConfig {
  appEnsName: string
  appContractName: string
  appRoles: Role[]
  appDependencies: Dependencies[]
  appSrcPath: string
  appBuildOutputPath: string
  appBuildScript: string
  ignoreFilesPath: string
}

export interface AragonUserConfig {
  appEnsName: string
  appContractName: string
  appRoles?: Role[]
  appDependencies?: Dependencies[]
  appSrcPath?: string
  appBuildOutputPath?: string
  appBuildScript?: string
  ignoreFilesPath?: string
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
  abi:
    | string
    | { payable: boolean; stateMutability: string; type: string }
    | null
}

export interface RoleWithBytes extends Role {
  bytes: string // '0x5de467a460382d13defdc02aacddc9c7d6605d6d4e0b8bd2f70732cae8ea17bc'
}

export interface AragonArtifact {
  roles: RoleWithBytes[]
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
  dependencies: Dependencies[]
  /**
   * The flaten source code of the contracts must be included in
   * any type of release at this path
   */
  flattenedCode: string // "./code.sol"
  appId: string
  appName: string
}

export interface RepoContent {
  artifact: AragonArtifact
  manifest: AragonManifest
  flatCode: string
}
