// We load the plugin here.
import { HardhatUserConfig } from 'hardhat/types'

import '../../../src/internal/index'

process.removeAllListeners('warning')

const config: HardhatUserConfig = {
  solidity: '0.4.24',
  defaultNetwork: 'hardhat',
  aragon: {
    appEnsName: 'counter333.open.aragonpm.eth',
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
      key: 'bb35e98d2d039a6b518d',
      secret:
        '4b10c468ae70d42b239d08ddddc7de08c07fb515f20a7650303d5156afd7b71c',
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
  },
}

export default config
