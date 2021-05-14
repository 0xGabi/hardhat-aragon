// We load the plugin here.
import { HardhatUserConfig } from 'hardhat/types'

import '../../../src/internal/index'

process.removeAllListeners('warning')

const config: HardhatUserConfig = {
  solidity: '0.4.24',
  defaultNetwork: 'hardhat',
  aragon: {
    appEnsName: 'counter.open.aragonpm.eth',
    appContractName: 'Counter',
    appRoles: [
      {
        name: 'Increment the counter',
        id: 'INCREMENT_ROLE',
        params: [],
      },
      {
        name: 'Decrement the counter',
        id: 'DECREMENT_ROLE',
        params: [],
      },
    ],
  },
  ipfs: {
    pinata: {
      key: process.env.PINATA_KEY || '',
      secret: process.env.PINATA_SECRET_KEY || '',
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: 'https://xdai-archive.blockscout.com',
        blockNumber: 15627460,
      },
      ensRegistry: '0xaafca6b0c89521752e559650206d7c925fd0e530',
    },
    localhost: {
      ensRegistry: '0xaafca6b0c89521752e559650206d7c925fd0e530',
    },
  },
}

export default config
