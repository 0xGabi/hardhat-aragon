import { AragonConfig } from './types'

declare module 'hardhat/types' {
  interface HardhatConfig {
    aragon?: AragonConfig
  }

  interface HttpNetworkConfig {
    ensAddress?: string
  }
}
