'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

test('encode/decode up to 31 bytes strings', async function (t) {
  const encoder = msgpack()
  const all = []

  for (let i = 'a'; i.length < 32; i += 'a') {
    all.push(i)
  }

  for (const str of all) {
    await t.test('encoding a string of length ' + str.length, async function (t) {
      const buf = encoder.encode(str)
      t.assert.strictEqual(buf.length, 1 + Buffer.byteLength(str), 'must have 2 bytes')
      t.assert.strictEqual(buf[0] & 0xe0, 0xa0, 'must have the proper header')
      t.assert.strictEqual(buf.toString('utf8', 1, Buffer.byteLength(str) + 1), str, 'must decode correctly')
    })

    await t.test('decoding a string of length ' + str.length, async function (t) {
      const buf = Buffer.allocUnsafe(1 + Buffer.byteLength(str))
      buf[0] = 0xa0 | Buffer.byteLength(str)
      buf.write(str, 1)
      t.assert.strictEqual(encoder.decode(buf), str, 'must decode correctly')
    })

    await t.test('mirror test a string of length ' + str.length, async function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(str)), str, 'must stay the same')
    })
  }
})
