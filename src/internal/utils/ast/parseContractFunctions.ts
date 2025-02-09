import { keyBy } from 'lodash'
import path from 'path'
import { visit, parse } from '@solidity-parser/parser'
import { HardhatPluginError } from 'hardhat/plugins'
import {
  ContractDefinition,
  FunctionDefinition,
  ModifierInvocation,
  VariableDeclaration,
} from '@solidity-parser/parser/src/ast-types'

import { parseFunctionsNotices } from './parseFunctionNotices'
import { AragonContractFunction } from './types'

/**
 * Helper to parse the role name from a modifier node
 * Using an isolated function to use a switch / return structure
 * @param node
 * @return "CREATE_PAYMENTS_ROLE"
 */
function parseRoleIdFromNode(node: ModifierInvocation): string {
  const [roleIdArg] = node.arguments || []
  switch (roleIdArg.type) {
    case 'Identifier':
      // Common usage with a pre-defined variable
      // CREATE_PAYMENTS_ROLE = keccak256('CREATE_PAYMENTS_ROLE');
      // auth(CREATE_PAYMENTS_ROLE);
      return roleIdArg.name
    default:
      // Unknown parsing state
      return ''
  }
}

/**
 * Helper to parse the role param count from a modifier node
 * Using an isolated function to use a switch / return structure
 * @param node
 */
function parseRoleParamCountFromNode(
  node: ModifierInvocation,
  authHelperFunctions: Set<string>
): number {
  const [, paramsArg] = node.arguments || []
  if (!paramsArg) return 0
  if (
    paramsArg.type === 'FunctionCall' &&
    paramsArg.expression.type === 'Identifier' &&
    authHelperFunctions.has(paramsArg.expression.name)
  ) {
    // Argument is an valid auth helper function that returns uint256[]
    // so its arguments can be considered for the role param count
    return paramsArg.arguments.length
  }

  // Unknown parsing state
  return 0
}

/**
 * Parse the function signature from a node to latter match it with
 * it ABI, as it's necessary for artifact.json's .functions property
 * @param node
 */
function parseFunctionSignatureFromNode(node: FunctionDefinition): string {
  const paramTypes = node.parameters.map(
    /**
     * Helper to parse the paramType of an argument to guess the signature
     * Using an isolated function to use a switch / return structure
     */
    (nodeParam: VariableDeclaration): string => {
      switch (nodeParam.typeName?.type) {
        case 'ElementaryTypeName':
          return nodeParam.typeName.name
        case 'ArrayTypeName':
          // eslint-disable-next-line no-case-declarations
          const { baseTypeName, length } = nodeParam.typeName
          if (baseTypeName.type === 'ElementaryTypeName') {
            if (length && length.type === 'IndexAccess') {
              // Known length uint[3]
              return `${baseTypeName.name}[${length.index}]`
            } else if (!length) {
              // Unknown length uint[]
              return `${baseTypeName.name}[]`
            } else {
              return ''
            }
          }
          return ''
        case 'UserDefinedTypeName':
          return 'address'
      }
      return 'address'
    }
  )
  // Don't return "fallback()" for the fallback function
  return node.name ? `${node.name}(${paramTypes.join(',')})` : 'fallback()'
}

/**
 * Parses relevant function and roles information from a contract's solidity
 * source code. Returns:
 * - All external / public state modifying functions and their roles
 * - Guesses the param count of the roles, if a normal syntax if used
 *
 * Roles are expected to be used with these two modifiers exclusively
 * - modifier auth(bytes32 _role)
 * - modifier authP(bytes32 _role, uint256[] _params)
 *
 * @param sourceCode Solidity flatten source code
 * @param targetContract "Counter" | "contract/Counter.sol"
 * @param options
 * - onlyTargetContract Only include functions from the target contract
 */
export function parseContractFunctions(
  sourceCode: string,
  targetContract: string,
  options?: {
    onlyTargetContract?: boolean
  }
): AragonContractFunction[] {
  const { onlyTargetContract } = options || {}

  const targetContractName = path.parse(targetContract).name
  const ast = parse(sourceCode, {})
  const functions: AragonContractFunction[] = []
  const authHelperFunctions: Set<string> = new Set()
  const parsedContract: Set<string> = new Set()

  // Aggregate valid auth helper functions first to help count
  // the role params in a safer and more flexible way
  visit(ast, {
    FunctionDefinition: (node: FunctionDefinition) => {
      if (
        node.name &&
        node.visibility === 'internal' &&
        node.stateMutability === 'pure' &&
        node.returnParameters &&
        node.returnParameters.length === 1
      ) {
        const returnParam = node.returnParameters[0]
        if (
          returnParam.typeName?.type === 'ArrayTypeName' &&
          returnParam.typeName.baseTypeName.type === 'ElementaryTypeName' &&
          returnParam.typeName.baseTypeName.name === 'uint256'
        )
          authHelperFunctions.add(node.name)
      }
    },
  })

  // Parse contract definitions in the first ast node which should be a SourceUnit
  if (ast.type !== 'SourceUnit')
    throw new HardhatPluginError(
      'First block is not of expected type SourceUnit'
    )
  // Aggregate all contracts for recursively parsing bases below
  const contracts: ContractDefinition[] = ast.children.filter(
    (node) => node.type === 'ContractDefinition' && node.kind === 'contract'
  ) as any

  function parseContract(node: ContractDefinition): void {
    // Parse functions
    for (const subNode of node.subNodes) {
      if (subNode.type === 'FunctionDefinition') {
        const functionNode = subNode as FunctionDefinition

        if (
          // Ignore constructors
          !functionNode.isConstructor &&
          // Only consider functions that modify state and are public / external
          functionNode.visibility !== 'internal' &&
          functionNode.visibility !== 'private' &&
          functionNode.stateMutability !== 'view' &&
          functionNode.stateMutability !== 'pure' &&
          functionNode.stateMutability !== 'constant'
        ) {
          // Check the modifiers
          functions.push({
            name: functionNode.name || '',
            notice: '',
            // Parse parameters for signature, some functions may be overloaded
            sig: parseFunctionSignatureFromNode(functionNode),
            // Parse the auth modifiers
            roles: functionNode.modifiers
              .filter((modNode) => ['auth', 'authP'].includes(modNode.name))
              .map((authModNode) => ({
                id: parseRoleIdFromNode(authModNode),
                paramCount: parseRoleParamCountFromNode(
                  authModNode,
                  authHelperFunctions
                ),
              })),
          })
        }
      }
    }

    // Parse base contracts
    for (const baseContract of node.baseContracts) {
      const baseName = baseContract.baseName.namePath
      // Protect against infinite loops with a Set
      if (baseName && !parsedContract.has(baseName)) {
        parsedContract.add(node.name)
        const contract = contracts.find((node) => node.name === baseName)
        if (contract && !onlyTargetContract) parseContract(contract)
      }
    }
  }

  // Start the parsing from the target contract find by "contractName"
  // or if not found, start with the last contract which in
  // flatten source should be the target contract
  parseContract(
    (targetContractName &&
      contracts.find((node) => node.name === targetContractName)) ||
      contracts[contracts.length - 1]
  )

  // # Pending: Curent @solidity-parser/parser version does not parse notices
  // which are parsed here separately using regex against the source string
  // Functions are mapped with each other on a best effort using their
  // guessed signature, which may be wrong if complex syntax is used
  const notices = parseFunctionsNotices(sourceCode)
  const noticesBySignature = keyBy(notices, (n) => n.signature)
  for (const fn of functions)
    if (!fn.notice) {
      const extractedNotice = (noticesBySignature[fn.sig] || {}).notice
      // notice = null if notice not found, '' if empty
      fn.notice = typeof extractedNotice === 'string' ? extractedNotice : null
    }
  return functions
}
