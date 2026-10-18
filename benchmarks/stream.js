'use strict'

// Streaming decoder benchmark: throughput of msgpack5's .decoder() stream
// compared to msgpackr's UnpackrStream, for one small object written many times.
// msgpackr is optional; if it is not installed only msgpack5 is measured.

const msgpack5 = require('../')()
let msgpackr = null
try { msgpackr = require('msgpackr') } catch (e) {}

const data = { greeting: 'Hello, World!', n: 42, arr: [1, 2, 3, 4, 5], nested: { a: true, b: null, c: 'x'.repeat(64) } }
const budget = Number(process.env.BENCH_MS || 5000)

function run (name, decoder, encoded) {
  return new Promise((resolve) => {
    let total = 0
    decoder.on('data', () => { total++ })
    decoder.on('error', (e) => { console.log(name, 'error', e.message); resolve() })
    const start = Date.now()
    function pump () {
      while (Date.now() - start < budget) {
        if (!decoder.write(encoded)) { decoder.once('drain', pump); return }
      }
      const dt = Date.now() - start
      console.log(String(name).padEnd(28) + ' | ' + String(total).padStart(8) + ' | ' + String(dt).padStart(5) + ' | ' + String(Math.floor(total / dt * 1000)).padStart(8))
      resolve()
    }
    pump()
  })
}

async function main () {
  const encoded = Buffer.from(msgpack5.encode(data))
  console.log('data JSON length:', JSON.stringify(data).length, 'encoded bytes:', encoded.length)
  await run('msgpack5 .decoder()', msgpack5.decoder(), encoded)
  if (msgpackr) {
    const dr = new msgpackr.UnpackrStream({ useRecords: false })
    await run('msgpackr UnpackrStream', dr, encoded)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
