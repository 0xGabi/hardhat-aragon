// If your plugin extends types from another plugin, you should import the plugin here.

// To extend one of Hardhat's types, you need to import the module where it has been defined, and redeclare it.
import 'hardhat/types/config'
import 'hardhat/types/runtime'

import { AragonConfig, IpfsConfig } from './types'

declare module 'hardhat/types/config' {
  export interface HardhatUserConfig {
    ipfs?: IpfsConfig
    aragon: AragonConfig
  }

  export interface HardhatConfig {
    ipfs: IpfsConfig
    aragon: AragonConfig
  }

  export interface HardhatNetworkUserConfig {
    ensAppName?: string
    ensRegistry?: string
  }

  export interface HttpNetworkUserConfig {
    ensAppName?: string
    ensRegistry?: string
  }

  export interface HardhatNetworkConfig {
    ensAppName?: string
    ensRegistry?: string
  }

  export interface HttpNetworkConfig {
    ensAppName?: string
    ensRegistry?: string
  }
}

declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    ipfs: any
  }
}
