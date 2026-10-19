'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encoding/decoding 32-bits float numbers', async function (t) {
  const encoder = msgpack()
  const float32 = [
    1.5,
    0.15625,
    -2.5
  ]

  const float64 = [
    Math.pow(2, 150),
    1.337,
    2.2
  ]

  for (const num of float64) {
    await t.test('encoding ' + num, async function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 9, 'must have 5 bytes')
      t.assert.strictEqual(buf[0], 0xcb, 'must have the proper header')

      const dec = buf.readDoubleBE(1)
      t.assert.strictEqual(dec, num, 'must decode correctly')
    })

    await t.test('decoding ' + num, async function (t) {
      const buf = Buffer.allocUnsafe(9)
      buf[0] = 0xcb
      buf.writeDoubleBE(num, 1)

      const dec = encoder.decode(buf)
      t.assert.strictEqual(dec, num, 'must decode correctly')
    })

    await t.test('mirror test ' + num, async function (t) {
      const dec = encoder.decode(encoder.encode(num))
      t.assert.strictEqual(dec, num, 'must decode correctly')
    })
  }

  for (const num of float32) {
    await t.test('encoding ' + num, async function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 5, 'must have 5 bytes')
      t.assert.strictEqual(buf[0], 0xca, 'must have the proper header')

      const dec = buf.readFloatBE(1)
      t.assert.strictEqual(dec, num, 'must decode correctly')
    })

    await t.test('forceFloat64 encoding ' + num, async function (t) {
      const enc = msgpack({ forceFloat64: true })
      const buf = enc.encode(num)

      t.assert.strictEqual(buf.length, 9, 'must have 9 bytes')
      t.assert.strictEqual(buf[0], 0xcb, 'must have the proper header')

      const dec = buf.readDoubleBE(1)
      t.assert.strictEqual(dec, num, 'must decode correctly')
    })

    await t.test('decoding ' + num, async function (t) {
      const buf = Buffer.allocUnsafe(5)
      buf[0] = 0xca
      buf.writeFloatBE(num, 1)

      const dec = encoder.decode(buf)
      t.assert.strictEqual(dec, num, 'must decode correctly')
    })

    await t.test('mirror test ' + num, async function (t) {
      const dec = encoder.decode(encoder.encode(num))
      t.assert.strictEqual(dec, num, 'must decode correctly')
    })
  }
})

test('decoding an incomplete 32-bits float numbers', async function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(4)
  buf[0] = 0xca
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})

test('decoding an incomplete 64-bits float numbers', async function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(8)
  buf[0] = 0xcb
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
