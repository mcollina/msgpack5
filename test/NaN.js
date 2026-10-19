'use strict'

const test = require('node:test')
const msgpack = require('../')

test('encode NaN as 32-bit float', function (t) {
  const encoder = msgpack()

  const buf = encoder.encode(NaN)
  t.assert.strictEqual(buf[0], 0xca)
  t.assert.strictEqual(buf.byteLength, 5)
})

test('encode NaN as 64-bit float with forceFloat64', function (t) {
  const encoder = msgpack({ forceFloat64: true })

  const buf = encoder.encode(NaN)

  t.assert.strictEqual(buf[0], 0xcb)
  t.assert.strictEqual(buf.byteLength, 9)
})

test('round-trip 32-bit NaN', function (t) {
  const encoder = msgpack()

  t.assert.ok(Object.is(encoder.decode(encoder.encode(NaN)), NaN))
})

test('round-trip 64-bit NaN with forceFloat64', function (t) {
  const encoder = msgpack({ forceFloat64: true })

  t.assert.ok(Object.is(encoder.decode(encoder.encode(NaN)), NaN))
})

test('decode 64-bit NaN', function (t) {
  const encoder = msgpack()
  const buf = Buffer.alloc(9)
  buf.writeUInt8(0xcb, 0)
  buf.writeDoubleBE(NaN, 1)

  t.assert.ok(Object.is(encoder.decode(buf), NaN))
})
