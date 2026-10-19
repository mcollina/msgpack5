'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encoding/decoding 64-bits big-endian unsigned integers', async function (t) {
  const encoder = msgpack()
  const allNum = []

  allNum.push(0x0000000100000000)
  allNum.push(0xffffffffeeeee)

  for (const num of allNum) {
    await t.test('encoding ' + num, async function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 9, 'must have 9 bytes')
      t.assert.strictEqual(buf[0], 0xcf, 'must have the proper header')
      let result = 0
      for (let k = 7; k >= 0; k--) {
        result += (buf.readUInt8(k + 1) * Math.pow(2, (8 * (7 - k))))
      }
      t.assert.strictEqual(result, num, 'must decode correctly')
    })

    await t.test('mirror test ' + num, async function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(num)), num, 'must stay the same')
    })
  }
})

test('decoding an incomplete 64-bits big-endian unsigned integer', async function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(8)
  buf[0] = 0xcf
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
