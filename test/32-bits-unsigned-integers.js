'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encoding/decoding 32-bits big-endian unsigned integers', function (t) {
  const encoder = msgpack()
  const allNum = []

  for (let i = 65536; i < 0xffffffff; i += 102350237) {
    allNum.push(i)
  }

  allNum.push(0xfffffffe)
  allNum.push(0xffffffff)

  allNum.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 5, 'must have 5 bytes')
      t.assert.strictEqual(buf[0], 0xce, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt32BE(1), num, 'must decode correctly')
    })

    t.test('decoding ' + num, function (t) {
      const buf = Buffer.allocUnsafe(5)
      buf[0] = 0xce
      buf.writeUInt32BE(num, 1)
      t.assert.strictEqual(encoder.decode(buf), num, 'must decode correctly')
    })

    t.test('mirror test ' + num, function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(num)), num, 'must stay the same')
    })
  })
})

test('decoding an incomplete 32-bits big-endian unsigned integer', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(4)
  buf[0] = 0xce
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
