/* eslint-disable @typescript-eslint/camelcase */
import fs from 'fs'
// import * as Hash from 'typestub-ipfs-only-hash'
// import entire SDK
// import AWS from 'aws-sdk';
// import AWS object without services
// import AWS from 'aws-sdk/global';
// import individual service
import fleekStorage from '@fleekhq/fleek-storage-js'
import { log } from '../../ui/logger'
// import { FleekConfig } from '~/src/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
// const PIN_BY_HASH_API = 'pinByHash'

// export async function pinContent({
//   contentHash,
//   appEnsName,
//   version,
//   network,
//   pinata,
// }: {
//   contentHash: string
//   appEnsName: string
//   version: string
//   network: string
//   pinata: PinataConfig
// }): Promise<any | undefined> {
//   const url = urlJoin(DEFAULT_PINATA_API_ENDPOINT, 'pinning', PIN_BY_HASH_API)

//   const body = {
//     hashToPin: contentHash,
//     pinataMetadata: {
//       name: `${network}:${appEnsName}@${version}`,
//     },
//   }

//   try {
//     const response = await fetch(url, {
//       method: 'POST',
//       body: JSON.stringify(body),
//       headers: {
//         'Content-Type': 'application/json',
//         pinata_api_key: pinata.key,
//         pinata_secret_api_key: pinata.secret,
//       },
//     })

//     const data = await response.json()

//     return data
//   } catch (error) {
//     log(`Warning: Error while fetching pinata API with ${error}`)
//     return undefined
//   }
// }

export async function fleekUploadContent({
  contentHash,
  appEnsName,
  version,
  hre,
}: {
  contentHash: string
  appEnsName: string
  version: string
  hre: HardhatRuntimeEnvironment
}) {
  const fleekConfig = hre.config.ipfs.fleek
  if (!fleekConfig) {
    log(`config.ipfs.fleek not defined or not found`)
    return
  }
  const apiKey = fleekConfig.key
  const apiSecret = fleekConfig.secret

  log(`apiKey: ${apiKey} - apiSecret: ${apiSecret}`)

  const network = hre.network
}
// export async function listBucket() {
// const buckets = await fleekStorage.listBuckets({
//   apiKey,
//   apiSecret,
// })
// // log(`listBuckets result: ${buckets}`)
// for (const buck of buckets) {
//   log(`listBuckets result: ${buck.name}`)
// }

export async function listBucket({ hre }: { hre: HardhatRuntimeEnvironment }) {
  const fleekConfig = hre.config.ipfs.fleek
  if (!fleekConfig) {
    log(`config.ipfs.fleek not defined or not found`)
    return
  }
  const apiKey = fleekConfig.key
  const apiSecret = fleekConfig.secret

  const stream = fs.readFileSync('./test.txt')
  // log(`listBuckets result: ${stream}`)
  // const hash = await Hash.of(stream)
  // log(`listBuckets hash: ${hash}`)
  const uploadedFile = await fleekStorage.upload({
    apiKey,
    apiSecret,
    key: 'test2.txt',
    bucket: 'c3963ae5-3c0b-4752-b068-040f3f263566-bucket/folder',
    data: stream,
  })
  log(
    `listBuckets uploaded: ${uploadedFile.hash} ${uploadedFile.key} ${uploadedFile.hashV0} ${uploadedFile.publicUrl}`
  )

  const files = await fleekStorage.listFiles({
    apiKey,
    apiSecret,
    getOptions: ['bucket', 'key', 'hash', 'publicUrl'],
  })

  // log(`listBuckets result: ${files}`)
  for (const file of files) {
    log(`listBuckets file: ${file.key} ${file.hash} ${file.publicUrl}`)
  }

  // const file = await fleekStorage.getFileFromHash({
  //   hash: 'bafybeid6x4kg4lkpooleyo7yxxoaodq3svdfklmld6mtfvcaykwlih55sy',
  // })
  // log(`listBuckets result: ${file.key} ${file.hash} ${file.publicUrl}`)

  // return buckets
}
// export function listBucket(): void {
//   const s3 = new S3({
//     apiVersion: '2006-03-01',
//     accessKeyId: apiKey,
//     secretAccessKey: apiSecret,
//   })
//   s3.listBuckets((err, data) => {
//     log(`listBuckets err: ${err} - data: ${data}`)
//   })
// }
