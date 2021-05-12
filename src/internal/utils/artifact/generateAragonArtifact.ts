import { ethers } from 'ethers'
import { keyBy } from 'lodash'

import { AragonAppJson, AragonArtifact } from '../../../types'
import { getAppId } from '../appName'
import { parseContractFunctions, AragonContractFunction } from '../ast'
import { readArapp } from '../arappUtils'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { FunctionFragment } from '@ethersproject/abi'

const abiFallback = {
  payable: true,
  stateMutability: 'payable',
  type: 'fallback'
}

function _generateAragonArtifact(
  appName: string,
  abi: ethers.utils.Fragment[],
  functions: AragonContractFunction[]
): AragonArtifact {
  const abiFunctions = new ethers.utils.Interface(abi).functions
  const abiBySignature = keyBy(
    abiFunctions,
    (functionFragment: FunctionFragment) => functionFragment.format('sighash')
  )
  const arapp: AragonAppJson = readArapp()

  return {
    ...arapp,

    // Artifact appears to require the abi of each function
    functions: functions.map(parsedFn => ({
      roles: parsedFn.roles.map(role => role.id),
      notice: parsedFn.notice,
      abi:
        abiBySignature[parsedFn.sig] ||
        (parsedFn.sig === 'fallback' ? abiFallback : null),
      // #### Todo: Is the signature actually necessary?
      // > Will keep them for know just in case, they are found in current release
      sig: parsedFn.sig
    })),

    deprecatedFunctions: {},

    // Artifact appears to require the roleId to have bytes precomputed
    roles: (arapp.roles || []).map(role => ({
      ...role,
      bytes: ethers.utils.keccak256(role.id)
    })),

    abi,
    // Additional metadata
    flattenedCode: './code.sol',
    appName,
    appId: getAppId(appName)
  }
}

// Function Overloading logic

/**
 * Returns aragon artifact.json from app data
 * @param appName
 * @param abi
 * @param functions Parsed contract function info
 */
export function generateAragonArtifact(
  appName: string,
  abi: ethers.utils.Fragment[],
  functions: AragonContractFunction[]
): AragonArtifact

/**
 * Returns aragon artifact.json from app data
 * @param appName "finance" | "finance.aragonpm.eth"
 * @param abi
 * @param flatCode Flat code of target contract plus all imports
 * @param contractName Target contract name or path: "Finance" | "contracts/Finance.sol"
 */
export function generateAragonArtifact(
  appName: string,
  abi: ethers.utils.Fragment[],
  flatCode: string,
  contractName: string,
  hre: HardhatRuntimeEnvironment
): AragonArtifact

export function generateAragonArtifact(
  appName: string,
  abi: ethers.utils.Fragment[],
  functionsOrSourceCode: AragonContractFunction[] | string,
  contractName?: string
): AragonArtifact {
  if (typeof functionsOrSourceCode === 'string') {
    if (!contractName) throw Error('contractName must be defined')
    const functions = parseContractFunctions(
      functionsOrSourceCode,
      contractName
    )
    return _generateAragonArtifact(appName, abi, functions)
  } else if (Array.isArray(functionsOrSourceCode)) {
    return _generateAragonArtifact(appName, abi, functionsOrSourceCode)
  } else {
    throw Error(
      'Parameter functionsOrSourceCode must be of type AragonContractFunction[] | string'
    )
  }
}
