'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

test('encode/decode null', function (t) {
  const encoder = msgpack()

  t.assert.strictEqual(encoder.encode(null)[0], 0xc0, 'encode null as 0xc0')
  t.assert.strictEqual(encoder.encode(null).length, 1, 'encode a buffer of length 1')
  t.assert.strictEqual(encoder.decode(Buffer.from([0xc0])), null, 'decode 0xc0 as null')
  t.assert.strictEqual(encoder.decode(encoder.encode(null)), null, 'mirror test null')
})
