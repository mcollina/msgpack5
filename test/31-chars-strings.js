'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encode/decode strings with max 31 of length', function (t) {
  const encoder = msgpack()
  const all = []

  // build base
  for (let i = ''; i.length < 32; i += 'a') {
    all.push(i)
  }

  all.forEach(function (str) {
    t.test('encoding a string of length ' + str.length, function (t) {
      const buf = encoder.encode(str)
      t.assert.strictEqual(buf.length, 1 + Buffer.byteLength(str), 'must be the proper length')
      t.assert.strictEqual(buf.readUInt8(0) & 0xe0, 0xa0, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt8(0) & 0x1f, Buffer.byteLength(str), 'must include the str length')
      t.assert.strictEqual(buf.toString('utf8', 1, Buffer.byteLength(str) + 2), str, 'must decode correctly')
    })

    t.test('decoding a string of length ' + str.length, function (t) {
      const buf = Buffer.allocUnsafe(1 + Buffer.byteLength(str))
      buf[0] = 0xa0 | Buffer.byteLength(str)
      if (str.length > 0) {
        buf.write(str, 1)
      }
      t.assert.strictEqual(encoder.decode(buf), str, 'must decode correctly')
    })

    t.test('mirror test a string of length ' + str.length, function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(str)), str, 'must stay the same')
    })
  })
})

test('decoding a chopped string', function (t) {
  const encoder = msgpack()
  const str = 'aaa'
  let buf = Buffer.allocUnsafe(1 + Buffer.byteLength(str))
  buf[0] = 0xa0 | Buffer.byteLength(str) + 2 // set bigger size
  buf.write(str, 1)
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
