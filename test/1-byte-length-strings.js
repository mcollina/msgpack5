'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encode/decode 32 <-> (2^8-1) bytes strings', function (t) {
  const encoder = msgpack()
  const all = []
  let i

  // build base
  for (i = 'a'; i.length < 32;) {
    i += 'a'
  }

  for (; i.length < Math.pow(2, 8); i += 'aaaaa') {
    all.push(i)
  }

  all.forEach(function (str) {
    t.test('encoding a string of length ' + str.length, function (t) {
      const buf = encoder.encode(str)
      t.assert.strictEqual(buf.length, 2 + Buffer.byteLength(str), 'must be the proper length')
      t.assert.strictEqual(buf.readUInt8(0), 0xd9, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt8(1), Buffer.byteLength(str), 'must include the str length')
      t.assert.strictEqual(buf.toString('utf8', 2, Buffer.byteLength(str) + 2), str, 'must decode correctly')
    })

    t.test('decoding a string of length ' + str.length, function (t) {
      const buf = Buffer.allocUnsafe(2 + Buffer.byteLength(str))
      buf[0] = 0xd9
      buf[1] = Buffer.byteLength(str)
      buf.write(str, 2)
      t.assert.strictEqual(encoder.decode(buf), str, 'must decode correctly')
    })

    t.test('mirror test a string of length ' + str.length, function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(str)), str, 'must stay the same')
    })
  })
})

test('decoding a chopped string', function (t) {
  const encoder = msgpack()
  let str
  for (str = 'a'; str.length < 40;) {
    str += 'a'
  }
  let buf = Buffer.allocUnsafe(2 + Buffer.byteLength(str))
  buf[0] = 0xd9
  buf[1] = Buffer.byteLength(str) + 10 // set bigger size
  buf.write(str, 2)
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})

test('decoding an incomplete header of a string', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(1)
  buf[0] = 0xd9
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
