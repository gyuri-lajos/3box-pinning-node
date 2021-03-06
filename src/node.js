#!/usr/bin/env node

const argv = require('yargs').argv
const path = require('path')
const Pinning = require('./pinning')
const { RedisCache, NullCache } = require('./cache')
const CacheService = require('./cacheService')
const Util = require('./util')
const Analytics = require('./analytics')

const env = process.env.NODE_ENV || 'development'
require('dotenv').config({ path: path.resolve(process.cwd(), `.env.${env}`) })

const ADDRESS_SERVER_URL = process.env.ADDRESS_SERVER_URL
const ORBITDB_PATH = process.env.ORBITDB_PATH
const IPFS_PATH = process.env.IPFS_PATH
const REDIS_PATH = process.env.REDIS_PATH
const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY
const ANALYTICS_ACTIVE = process.env.ANALYTICS_ACTIVE || true

const DAYS15 = 60 * 60 * 24 * 15 // 15 day ttl
const runCacheService = argv.runCacheService !== 'false'

const analyticsClient = new Analytics(SEGMENT_WRITE_KEY, ANALYTICS_ACTIVE)
const util = new Util(ORBITDB_PATH, IPFS_PATH)

function sendInfraMetrics () {
  analyticsClient.trackInfraMetrics(util.getTotalOrbitStores(), util.getOrbitDBDiskUsage, util.getIPFSDiskUsage())
}

async function start (runCacheService) {
  const cache = REDIS_PATH && runCacheService ? new RedisCache({ host: REDIS_PATH }, DAYS15) : new NullCache()
  const pinning = new Pinning(cache, IPFS_PATH, ORBITDB_PATH, analyticsClient)
  await pinning.start()
  setInterval(sendInfraMetrics, 1800000)
  if (runCacheService) {
    const cacheService = new CacheService(cache, pinning, ADDRESS_SERVER_URL)
    cacheService.start()
  }
}

start(runCacheService)
