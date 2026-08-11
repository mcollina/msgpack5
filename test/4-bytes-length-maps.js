'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

test('decoding incomplete map32 headers', function (t) {
  const pack = msgpack()

  for (let length = 1; length < 5; length++) {
    const buf = Buffer.alloc(length)
    buf[0] = 0xdf
    const input = bl().append(buf)

    t.throws(function () {
      pack.decode(input)
    }, pack.IncompleteBufferError, 'must reject a ' + length + '-byte header as incomplete')
    t.equal(input.length, length, 'must not consume an incomplete header')
  }

  t.end()
})

test('decoding an empty map32', function (t) {
  const pack = msgpack()
  const buf = Buffer.from([0xdf, 0x00, 0x00, 0x00, 0x00])

  t.deepEqual(pack.decode(buf), {}, 'must decode a complete map32 header')
  t.end()
})
