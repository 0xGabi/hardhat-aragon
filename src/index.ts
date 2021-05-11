import { extendConfig } from 'hardhat/config'
import '../bootstrap-paths'
import { configExtender } from './config'

// TODO: Don't use any type below, try to use something like these...
// import { ResolvedHardhatConfig, HardhatConfig } from 'hardhat/types'

export default function(): void {
  // Resolve tsconfig-paths at runtime.
  require('../bootstrap-paths.js')

  // Plugin dependencies.
  // usePlugin('hardhat-etherscan')

  // Task definitions.
  // Note: buidler sets up the environment by appending tasks to it. This happens when a task() function is called. Therefore, task() must be called on every test run, not only for the first time. However, when node imports a file with require the module body will only be run once on the first time and then use the cached result.
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { setupPublishTask } = require('./tasks/publish')
  setupPublishTask()
  /* eslint-enable @typescript-eslint/no-var-requires */

  // Environment extensions.
  // No extensions atm.

  // Default configuration values.
  extendConfig(configExtender)
}
