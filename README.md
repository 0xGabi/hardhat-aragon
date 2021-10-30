# Aragon Hardhat plugin

Hardhat plugin for publishing Aragon apps to [Aragon Package Manager](https://hack.aragon.org/docs/apm-intro.html).

## Required plugins

This plugin requires:

- [**@nomiclabs/hardhat-ethers**](https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html)
- [**hardhat-deploy**](https://hardhat.org/plugins/hardhat-deploy.html)

## Installation

```
yarn add --dev @1hve/hardhat-aragon @nomiclabs/hardhat-ethers ethers hardhat-deploy
```

And add the following statement to your hardhat.config.js:

```js
require('@1hive/hardhat-aragon')
require('@nomiclabs/hardhat-ethers')
require('hardhat-deploy')
```

Or, if you are using TypeScript, add this to your hardhat.config.ts:

```ts
import '@1hive/hardhat-aragon'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
```

## Tasks

This plugin provides the `publish` task, which allows you to publish an Aragon app to the Aragon Package Manager.

### Usage

```sh
hardhat [GLOBAL HARDHAT OPTIONS] publish --contract <STRING> [--dry-run] [--only-content] [--skip-app-build] [--skip-validation] bump [...constructorArgs]
```

### Options

- `--contract`: Contract address previously deployed.
- `--dry-run`: Output tx data without broadcasting.
- `--only-content`: Prevents contract compilation, deployment, and artifact generation.
- `--skip-app-build`: Skip application build.
- `--skip-validation`: Skip validation of artifacts files.

### Positional Arguments

- **bump**: Type of bump (major, minor or patch) or semantic version

- **constructorArgs**: Constructor arguments for the app contract. (default: `[]`)

## Config extensions

You need to add the following `aragon` config to your `hardhat.config` file:

```js
module.exports = {
  networks: {
    mainnet: { ... }
  },
  aragon: {
    appEnsName: string // counter.open.aragonpm.eth
    appContractName: string // Counter
  }
};
```

Additionaly you can also configure the optional `aragon` and `ipfs` configs:

```js
module.exports = {
  networks: {
    mainnet: { ... }
  },
  aragon: {
    appEnsName: string // counter.open.aragonpm.eth
    appContractName: string // Counter
    appRoles: Role[]
    appSrcPath: string // app/
    appBuildOutputPath: string // dist/
    appBuildScript: string  // build/
    ignoreFilesPath: string // .
  },
  ipfs: {
    url: string // https://ipfs.infura.io:5001/
    gateway: string // https://ipfs.io/
    pinata: {
      key: "YOUR_PINATA_API_KEY"
      secret: "YOUR_PINATA_API_SECRET_KEY"
    }
  }
```

Where `Role` has the interface:

```ts
interface Role {
  name: string // 'Create new payments'
  id: string // 'CREATE_PAYMENTS_ROLE'
  params: string[] //  ['Token address', ... ]
}
```

Finally the plugin also extend the hardhat network configuration to allow a custom `appEnsName` and `ensRegistry` per network:

```js
networks: {
    hardhat: {
      ensRegistry: '0xaafca6b0c89521752e559650206d7c925fd0e530',
    },
    rinkeby: {
      appEnsName: 'counter.aragonpm.eth',
      ensRegistry: '0x98df287b6c145399aaa709692c8d308357bc085d',
      ...
    },
  },
```

## Environment extensions

This plugins adds an `ipfs` object to the Hardhat Runtime Environment.

This object has the same API that [`ipfs-http-client`](https://github.com/ipfs/js-ipfs/tree/master/packages/ipfs-http-client).

This object is already initialized and ready to interact with the IPFS network. You can configure the node `url` to connect with on the `hardhat.config` file.

> **Note**<br>
> The plugin default `url` is `http://localhost:5001/` assuming you have a local IPFS node at that endpoint running. You can configure a custom `url` node like `https://ipfs.infura.io:5001/` if you don't want to run your own node.
