'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')

test('maxArrayLength limits decoded arrays', function (t) {
  const decoder = msgpack({ maxArrayLength: 2 })

  t.deepEqual(decoder.decode(Buffer.from([0x92, 0x01, 0x02])), [1, 2], 'allows the configured limit')
  t.throws(function () {
    decoder.decode(Buffer.from([0x93, 0x01, 0x02, 0x03]))
  }, /array length 3 exceeds configured limit of 2/, 'rejects fixarray over the limit')
  t.throws(function () {
    decoder.decode(Buffer.from([0xdc, 0x00, 0x03]))
  }, /array length 3 exceeds configured limit of 2/, 'rejects array16 before decoding its elements')
  t.throws(function () {
    decoder.decode(Buffer.from([0xdd, 0x00, 0x00, 0x00, 0x03]))
  }, /array length 3 exceeds configured limit of 2/, 'rejects array32 before decoding its elements')
  t.end()
})

test('maxMapLength limits decoded maps', function (t) {
  const decoder = msgpack({ maxMapLength: 1 })

  t.deepEqual(decoder.decode(Buffer.from([0x81, 0xa1, 0x61, 0x01])), { a: 1 }, 'allows the configured limit')
  t.throws(function () {
    decoder.decode(Buffer.from([0x82, 0xa1, 0x61, 0x01, 0xa1, 0x62, 0x02]))
  }, /map length 2 exceeds configured limit of 1/, 'rejects fixmap over the limit')
  t.throws(function () {
    decoder.decode(Buffer.from([0xde, 0x00, 0x02]))
  }, /map length 2 exceeds configured limit of 1/, 'rejects map16 before decoding its entries')
  t.throws(function () {
    decoder.decode(Buffer.from([0xdf, 0x00, 0x00, 0x00, 0x02]))
  }, /map length 2 exceeds configured limit of 1/, 'rejects map32 before decoding its entries')
  t.end()
})

test('collection limits apply independently and to nested values', function (t) {
  const decoder = msgpack({ maxArrayLength: 1, maxMapLength: 1 })

  t.deepEqual(decoder.decode(Buffer.from([0x81, 0xa1, 0x61, 0x91, 0x01])), { a: [1] }, 'allows nested collections at their limits')
  t.throws(function () {
    decoder.decode(Buffer.from([0x81, 0xa1, 0x61, 0x92, 0x01, 0x02]))
  }, /array length 2 exceeds configured limit of 1/, 'rejects a nested array over its limit')
  t.end()
})

test('collection limits must be non-negative safe integers', function (t) {
  const invalid = [-1, 1.5, Infinity, null, '1']

  invalid.forEach(function (value) {
    t.throws(function () {
      msgpack({ maxArrayLength: value })
    }, /maxArrayLength must be a non-negative safe integer/, 'rejects maxArrayLength ' + value)
    t.throws(function () {
      msgpack({ maxMapLength: value })
    }, /maxMapLength must be a non-negative safe integer/, 'rejects maxMapLength ' + value)
  })
  t.doesNotThrow(function () {
    msgpack({ maxArrayLength: 0, maxMapLength: Number.MAX_SAFE_INTEGER })
  }, 'accepts boundary values')
  t.end()
})
