// We load the plugin here.
import { HardhatUserConfig } from 'hardhat/types'

import '../../../src/internal/index'

process.removeAllListeners('warning')

const config: HardhatUserConfig = {
  solidity: '0.4.24',
  defaultNetwork: 'hardhat',
  aragon: {
    appEnsName: 'counter333.open.aragonpm.eth',
    appContractName: 'Counter'
  },
  ipfs: {
    pinning: {
      name: 'pinata',
      endpoint: 'https://api.pinata.cloud',
      key: '98e70822266a7ec39d4c'
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: 'https://xdai-archive.blockscout.com',
        blockNumber: 15627460
      },
      ensRegistry: '0xaafca6b0c89521752e559650206d7c925fd0e530'
    }
  }
}

export default config
