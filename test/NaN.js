'use strict'

const test = require('tape').test
const msgpack = require('../')

test('encode NaN as 32-bit float', function (t) {
  const encoder = msgpack()

  const buf = encoder.encode(NaN)
  t.equal(buf[0], 0xca)
  t.equal(buf.byteLength, 5)

  t.end()
})

test('encode NaN as 64-bit float with forceFloat64', function (t) {
  const encoder = msgpack({ forceFloat64: true })

  const buf = encoder.encode(NaN)

  t.equal(buf[0], 0xcb)
  t.equal(buf.byteLength, 9)

  t.end()
})

test('round-trip 32-bit NaN', function (t) {
  const encoder = msgpack()

  t.assert(Object.is(encoder.decode(encoder.encode(NaN)), NaN))

  t.end()
})

test('round-trip 64-bit NaN with forceFloat64', function (t) {
  const encoder = msgpack({ forceFloat64: true })

  t.assert(Object.is(encoder.decode(encoder.encode(NaN)), NaN))

  t.end()
})

test('decode 64-bit NaN', function (t) {
  const encoder = msgpack()
  const buf = Buffer.alloc(9)
  buf.writeUInt8(0xcb, 0)
  buf.writeDoubleBE(NaN, 1)

  t.assert(Object.is(encoder.decode(buf), NaN))

  t.end()
})
