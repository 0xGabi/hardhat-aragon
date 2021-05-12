import { HardhatPluginError } from 'hardhat/plugins'

import { AragonAppJson } from '../../types'
import { pathExists, readJson, readJsonIfExists } from './fsUtils'

const arappPath = 'arapp.json'

/**
 * Reads and parses an arapp.json file.
 * @return AragonAppJson
 */
export function readArapp(): AragonAppJson {
  if (!pathExists(arappPath))
    throw new HardhatPluginError(
      `No ${arappPath} found in current working directory\n ${process.cwd()}`
    )
  return readJson(arappPath)
}

/**
 * Reads and parses an arapp.json file only if exists
 * otherwise returns undefined
 */
export function readArappIfExists(): AragonAppJson | undefined {
  return readJsonIfExists(arappPath)
}

/**
 * Parse the appName from arapp.json in a flexible manner
 * @param arapp
 * @param network
 */
export function parseAppName(arapp: AragonAppJson, network?: string): string {
  if (!arapp.appName && !arapp.environments)
    throw new HardhatPluginError(
      `No appName configured. 
Add an 'appName' property in your arapp.json with your app's ENS name`
    )

  // Aggreate app names from environments
  const appNameByNetwork: { [network: string]: string } = {}
  for (const [_network, env] of Object.entries(arapp.environments)) {
    if (env.appName) appNameByNetwork[_network] = env.appName
  }

  // If there an appName for that network return it
  if (network && appNameByNetwork[network]) return appNameByNetwork[network]

  // If there's a default appName return it
  if (arapp.appName) {
    return arapp.appName
  } else {
    // Otherwise, try to guess the appName

    // Pre-compute booleans to make logic below readable
    const appNamesArr = Object.values(appNameByNetwork)
    const thereAreNames = appNamesArr.length > 0
    const allNamesAreEqual = appNamesArr.every(name => name === appNamesArr[0])

    if (thereAreNames && allNamesAreEqual) return appNamesArr[0]

    // If no guess was possible ask the user to provide it
    const networkId = network || 'development' // Don't print "undefined" for development
    throw new HardhatPluginError(
      `No appName configured for network ${networkId}. 
Add an 'appName' property in the environment of ${networkId} with your app's 
ENS name in your arapp.json. If your app's name is the name accross networks,
Add an 'appName' property in your arapp.json with your app's ENS name`
    )
  }
}
