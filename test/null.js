'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')

test('encode/decode null', function (t) {
  const encoder = msgpack()

  t.equal(encoder.encode(null)[0], 0xc0, 'encode null as 0xc0')
  t.equal(encoder.encode(null).length, 1, 'encode a buffer of length 1')
  t.equal(encoder.decode(Buffer.from([0xc0])), null, 'decode 0xc0 as null')
  t.equal(encoder.decode(encoder.encode(null)), null, 'mirror test null')

  t.end()
})
