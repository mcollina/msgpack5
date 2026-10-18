'use strict'

// Head-to-head encode/decode benchmark. Compares msgpack5 against whatever
// comparison libraries are installed (msgpackr, msgpack-lite, @msgpack/msgpack)
// and against JSON. Libraries that are not installed are skipped. Results are
// reported as ops/sec with ratios relative to msgpack5.
//
// Usage:
//   node benchmarks/bench.js                 # all datasets
//   node benchmarks/bench.js sample-large.json example4.json   # subset
//   BENCH_MS=3000 node benchmarks/bench.js   # shorter per-iteration budget

const fs = require('fs')
const path = require('path')
const msgpack5 = require('../')()

const { ensureData } = require('./gen-data')
const msLimit = Number(process.env.BENCH_MS || 4000)
const files = process.argv.length > 2
  ? process.argv.slice(2)
  : ['sample-large.json', 'example4.json', 'example5.json', 'mixed.json']

function tryRequire (name) {
  try { return require(name) } catch (e) { return null }
}

const msgpackrModule = tryRequire('msgpackr')
const msgpackLite = tryRequire('msgpack-lite')
const atMsgpack = tryRequire('@msgpack/msgpack')
const msgpackrLib = msgpackrModule ? new msgpackrModule.Packr({ useRecords: false }) : null

// Fixed wall-clock budget: count iterations until the budget is spent.
function bench (fn, src) {
  const start = Date.now()
  let count = 0
  for (;;) {
    if (Date.now() - start >= msLimit) break
    while ((++count) % 100) fn(src)
  }
  return Math.floor(count / (Date.now() - start) * 1000)
}

function safe (fn, src) {
  try { return bench(fn, src) } catch (e) { return null }
}

function runLibrary (encodeFn, decodeFn, data, expected) {
  const encodeOps = safe(encodeFn, data)
  if (encodeOps === null) return { encodeOps: null, decodeOps: null, match: null }

  const encoded = encodeFn(data)
  const decodeOps = safe(decodeFn, encoded)
  let match = false
  try { match = JSON.stringify(decodeFn(encoded)) === expected } catch (e) { match = false }
  return { encodeOps, decodeOps, match }
}

function pad (s, n) { return String(s).padEnd(n) }
function num (v, n) { return v == null ? '   n/a' : String(v).padStart(n) }

const libs = [
  { label: 'msgpack5', encode: msgpack5.encode, decode: msgpack5.decode, ref: true },
  { label: 'msgpackr', encode: msgpackrLib && msgpackrLib.pack.bind(msgpackrLib), decode: msgpackrLib && msgpackrLib.unpack.bind(msgpackrLib), ref: true },
  { label: 'msgpack-lite', encode: msgpackLite && msgpackLite.encode, decode: msgpackLite && msgpackLite.decode, ref: false },
  { label: '@msgpack/msgpack', encode: atMsgpack && atMsgpack.encode, decode: atMsgpack && atMsgpack.decode, ref: false },
  { label: 'JSON', encode: JSON.stringify, decode: JSON.parse, ref: false }
].filter(l => l.encode && l.decode)

const dir = ensureData()
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  const expected = JSON.stringify(data)

  const results = {}
  for (const lib of libs) {
    results[lib.label] = runLibrary(lib.encode, lib.decode, data, expected)
  }

  console.log('\n== ' + file + ' (JSON ' + expected.length + ' bytes) ==')
  const m5 = results.msgpack5
  for (const lib of libs) {
    const r = results[lib.label]
    const ratioE = r.encodeOps != null && m5.encodeOps ? (r.encodeOps / m5.encodeOps).toFixed(3) : '  -'
    const ratioD = r.decodeOps != null && m5.decodeOps ? (r.decodeOps / m5.decodeOps).toFixed(3) : '  -'
    console.log(
      pad(lib.label, 16) +
      ' | encode ' + num(r.encodeOps, 8) +
      ' | decode ' + num(r.decodeOps, 8) +
      ' | ratio ' + ratioE + '/' + ratioD +
      ' | match ' + r.match
    )
  }
  console.log('--- vs msgpack5 ---')
  for (const lib of libs) {
    if (lib.label === 'msgpack5') continue
    const r = results[lib.label]
    if (r.encodeOps && m5.encodeOps) console.log(lib.label + ' encode:', (r.encodeOps / m5.encodeOps).toFixed(3))
    if (r.decodeOps && m5.decodeOps) console.log(lib.label + ' decode:', (r.decodeOps / m5.decodeOps).toFixed(3))
  }
}
