'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encoding/decoding 64-bits float numbers', async function (t) {
  const encoder = msgpack()
  const allNum = []

  allNum.push(748365544534.2)
  allNum.push(-222111111000004.2)
  allNum.push(9007199254740992)
  allNum.push(-9007199254740992)

  for (const num of allNum) {
    await t.test('encoding ' + num, async function (t) {
      const buf = encoder.encode(num)
      const dec = buf.readDoubleBE(1)
      t.assert.strictEqual(buf.length, 9, 'must have 9 bytes')
      t.assert.strictEqual(buf[0], 0xcb, 'must have the proper header')
      t.assert.ok(Math.abs(dec - num) < 0.1, 'must decode correctly')
    })

    await t.test('decoding ' + num, async function (t) {
      const buf = Buffer.allocUnsafe(9)
      buf[0] = 0xcb
      buf.writeDoubleBE(num, 1)
      const dec = encoder.decode(buf)
      t.assert.ok(Math.abs(dec - num) < 0.1, 'must decode correctly')
    })

    await t.test('mirror test ' + num, async function (t) {
      const dec = encoder.decode(encoder.encode(num))
      t.assert.ok(Math.abs(dec - num) < 0.1, 'must decode correctly')
    })
  }
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
