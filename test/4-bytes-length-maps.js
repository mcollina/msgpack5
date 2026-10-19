'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('decoding incomplete map32 headers', function (t) {
  const pack = msgpack()

  for (let length = 1; length < 5; length++) {
    const buf = Buffer.alloc(length)
    buf[0] = 0xdf
    const input = new DynamicBuffer().append(buf)

    t.assert.throws(function () {
      pack.decode(input)
    }, pack.IncompleteBufferError, 'must reject a ' + length + '-byte header as incomplete')
    t.assert.strictEqual(input.length, length, 'must not consume an incomplete header')
  }
})

test('decoding an empty map32', function (t) {
  const pack = msgpack()
  const buf = Buffer.from([0xdf, 0x00, 0x00, 0x00, 0x00])

  t.assert.deepStrictEqual(pack.decode(buf), {}, 'must decode a complete map32 header')
})
