'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encoding/decoding 16-bits big-endian signed integers', async function (t) {
  const encoder = msgpack()
  const allNum = []
  let i

  for (i = 129; i < 32768; i += 1423) {
    allNum.push(-i)
  }

  allNum.push(-32768)

  for (const num of allNum) {
    await t.test('encoding ' + num, async function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 3, 'must have 3 bytes')
      t.assert.strictEqual(buf[0], 0xd1, 'must have the proper header')
      t.assert.strictEqual(buf.readInt16BE(1), num, 'must decode correctly')
    })

    await t.test('decoding ' + num, async function (t) {
      const buf = Buffer.allocUnsafe(3)
      buf[0] = 0xd1
      buf.writeInt16BE(num, 1)
      t.assert.strictEqual(encoder.decode(buf), num, 'must decode correctly')
    })

    await t.test('mirror test ' + num, async function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(num)), num, 'must stay the same')
    })
  }
})

test('decoding an incomplete 16-bits big-endian integer', async function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(2)
  buf[0] = 0xd1
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
