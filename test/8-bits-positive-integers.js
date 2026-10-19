'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encoding/decoding 8-bits integers', function (t) {
  const encoder = msgpack()
  const allNum = []

  for (let i = 128; i < 256; i++) {
    allNum.push(i)
  }

  allNum.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 2, 'must have 2 bytes')
      t.assert.strictEqual(buf[0], 0xcc, 'must have the proper header')
      t.assert.strictEqual(buf[1], num, 'must decode correctly')
    })

    t.test('decoding ' + num, function (t) {
      const buf = Buffer.from([0xcc, num])
      t.assert.strictEqual(encoder.decode(buf), num, 'must decode correctly')
    })

    t.test('mirror test ' + num, function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(num)), num, 'must stay the same')
    })
  })
})

test('decoding an incomplete 8-bits unsigned integer', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(1)
  buf[0] = 0xcc
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
