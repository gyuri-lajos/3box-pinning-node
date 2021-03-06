const fs = require('fs')
const elliptic = require('elliptic')
const getSize = require('get-folder-size')
const Multihash = require('multihashes')
const sha256 = require('js-sha256').sha256
const { InvalidDIDFormat } = require('./errors')

const RE_DID_MUPORT = /^did:muport:(\w+)$/

/**
 *  Collection of utilities to measure important KPIs
 */
class Util {
  constructor (orbitDbDir, ipfsDir) {
    this.orbitDbDir = orbitDbDir
    this.ipfsDir = ipfsDir
  }

  getTotalOrbitStores () {
    let total = 0
    total = fs.readdirSync(this.orbitDbDir, (err, files) => {
      if (err) {
        throw new Error('Error getting the number of root stores', err)
      }
      return files
    })
    return total.length
  }

  getIPFSDiskUsage () {
    return this._getDiskUsage(this.ipfsDir)
  }

  getOrbitDBDiskUsage () {
    return this._getDiskUsage(this.orbitDbDir)
  }

  _getDiskUsage (dir) {
    let totalSize = 0
    getSize(dir, (err, size) => {
      if (err) { throw err }
      totalSize = size
    })
    return (totalSize / 1024 / 1024).toFixed(2) + ' Mb'
  }

  /**
   * Compute a multi-hash that is used in the did to root store process (fingerprinting)
   */
  static sha256Multihash (str) {
    const digest = Buffer.from(sha256.digest(str))
    return Multihash.encode(digest, 'sha2-256').toString('hex')
  }

  static uncompressSECP256K1Key (key) {
    const ec = new elliptic.ec('secp256k1') // eslint-disable-line new-cap
    return ec.keyFromPublic(key, 'hex').getPublic(false, 'hex')
  }

  static didExtractIPFSAddress (did) {
    if (!did) {
      throw InvalidDIDFormat('null')
    }

    const match = did.match(RE_DID_MUPORT)

    if (!match) {
      throw InvalidDIDFormat(did)
    }

    return match[1]
  }

  static async didExtractSigningKey (manifestIPFSAddr, ipfs) {
    const content = await ipfs.files.cat(manifestIPFSAddr)
    const data = JSON.parse(content.toString())
    return data.signingKey
  }

  static async didToRootStoreAddress (did, { ipfs, orbitdb }) {
    const ipfsManifest = Util.didExtractIPFSAddress(did)
    const signingKeyCompressed = await Util.didExtractSigningKey(ipfsManifest, ipfs)

    const signingKey = Util.uncompressSECP256K1Key(signingKeyCompressed)
    const fingerprint = Util.sha256Multihash(did)

    const rootStore = `${fingerprint}.root`

    const addr = await orbitdb.determineAddress(rootStore, 'feed', { write: [signingKey] })

    return addr.toString()
  }
}

module.exports = Util
