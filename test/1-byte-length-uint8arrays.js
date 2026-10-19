'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

function build (size) {
  const array = []
  let i

  for (i = 0; i < size; i++) {
    array.push(42)
  }

  return new Uint8Array(array)
}

test('encode/decode 2^8-1 Uint8Arrays', async function (t) {
  const encoder = msgpack()
  const all = []

  all.push(build(Math.pow(2, 8) - 1))
  all.push(build(Math.pow(2, 6) + 1))
  all.push(build(1))
  all.push(new Uint8Array(0))

  for (const array of all) {
    await t.test('encoding Uint8Array of length ' + array.byteLength + ' bytes', async function (t) {
      const buf = encoder.encode(array)
      t.assert.strictEqual(buf.length, 2 + array.byteLength, 'must have the right length')
      t.assert.strictEqual(buf.readUInt8(0), 0xc4, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt8(1), array.byteLength, 'must include the buf length')
    })

    await t.test('mirror test for an Uint8Array of length ' + array.byteLength + ' bytes', async function (t) {
      t.assert.deepStrictEqual(encoder.decode(encoder.encode(array)), Buffer.from(array), 'must stay the same')
    })
  }
})
