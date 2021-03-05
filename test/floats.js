'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

test('encoding/decoding 32-bits float numbers', function (t) {
  const encoder = msgpack()
  const float32 = [
    1.5,
    0.15625,
    -2.5
  ]

  const float64 = [
    Math.pow(2, 150),
    1.337,
    2.2
  ]

  float64.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      t.equal(buf.length, 9, 'must have 5 bytes')
      t.equal(buf[0], 0xcb, 'must have the proper header')

      const dec = buf.readDoubleBE(1)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('decoding ' + num, function (t) {
      const buf = Buffer.allocUnsafe(9)
      buf[0] = 0xcb
      buf.writeDoubleBE(num, 1)

      const dec = encoder.decode(buf)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('mirror test ' + num, function (t) {
      const dec = encoder.decode(encoder.encode(num))
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })
  })

  float32.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      t.equal(buf.length, 5, 'must have 5 bytes')
      t.equal(buf[0], 0xca, 'must have the proper header')

      const dec = buf.readFloatBE(1)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('forceFloat64 encoding ' + num, function (t) {
      const enc = msgpack({ forceFloat64: true })
      const buf = enc.encode(num)

      t.equal(buf.length, 9, 'must have 9 bytes')
      t.equal(buf[0], 0xcb, 'must have the proper header')

      const dec = buf.readDoubleBE(1)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('decoding ' + num, function (t) {
      const buf = Buffer.allocUnsafe(5)
      buf[0] = 0xca
      buf.writeFloatBE(num, 1)

      const dec = encoder.decode(buf)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('mirror test ' + num, function (t) {
      const dec = encoder.decode(encoder.encode(num))
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })
  })

  t.end()
})

test('decoding an incomplete 32-bits float numbers', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(4)
  buf[0] = 0xca
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})

test('decoding an incomplete 64-bits float numbers', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(8)
  buf[0] = 0xcb
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
