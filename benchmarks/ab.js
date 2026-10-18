'use strict'

// A/B benchmark comparing two local msgpack5 checkouts. Set AB_OLD and AB_NEW to
// absolute repo paths (e.g. a git worktree of the baseline and the current tree).
//
//   AB_OLD=/path/to/baseline AB_NEW=/path/to/current node benchmarks/ab.js
//
// Interleaves encode/decode rounds on sample-large.json and reports the median
// ops/sec for each build plus the new/old ratio (ratio > 1 means NEW is faster).

const fs = require('fs')
const path = require('path')

const oldPath = process.env.AB_OLD
const newPath = process.env.AB_NEW
const rounds = Number(process.env.AB_ROUNDS || 5)
const msLimit = Number(process.env.BENCH_MS || 3000)

if (!oldPath || !newPath) {
  console.error('usage: AB_OLD=<path> AB_NEW=<path> node benchmarks/ab.js')
  process.exit(1)
}

const oldPack = require(oldPath)()
const newPack = require(newPath)()
const { ensureData } = require('./gen-data')

const data = JSON.parse(fs.readFileSync(path.join(ensureData(), 'sample-large.json'), 'utf8'))
const encoded = Buffer.from(oldPack.encode(data))

function bench (decodeFn, buf) {
  const start = Date.now()
  let n = 0
  while (Date.now() - start < msLimit) { decodeFn(buf); n++ }
  return Math.floor(n / (Date.now() - start) * 1000)
}

function median (arr) {
  const s = arr.slice().sort((a, b) => a - b)
  return s[(s.length - 1) >> 1]
}

function measureInterleaved (decodeFn) {
  const oldVals = []
  const newVals = []
  for (let i = 0; i < rounds; i++) {
    oldVals.push(bench(oldPack.decode, encoded))
    newVals.push(bench(newPack.decode, encoded))
    newVals.push(bench(newPack.decode, encoded))
    oldVals.push(bench(oldPack.decode, encoded))
  }
  return { old: median(oldVals), new: median(newVals) }
}

const decode = measureInterleaved()
const encodeOld = []
const encodeNew = []
for (let i = 0; i < rounds; i++) {
  const startO = Date.now(); let no = 0
  while (Date.now() - startO < msLimit) { oldPack.encode(data); no++ }
  encodeOld.push(Math.floor(no / (Date.now() - startO) * 1000))
  const startN = Date.now(); let nn = 0
  while (Date.now() - startN < msLimit) { newPack.encode(data); nn++ }
  encodeNew.push(Math.floor(nn / (Date.now() - startN) * 1000))
}

console.log('baseline:', oldPath)
console.log('current :', newPath)
console.log('sample-large.json, per ' + msLimit + 'ms, ' + rounds + ' rounds (median)')
console.log('decode old:', decode.old, 'new:', decode.new, 'ratio new/old:', (decode.new / decode.old).toFixed(3))
console.log('encode old:', median(encodeOld), 'new:', median(encodeNew), 'ratio new/old:', (median(encodeNew) / median(encodeOld)).toFixed(3))
