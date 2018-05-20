'use strict'

var Buffer = require('safe-buffer').Buffer
var test = require('tape').test
var msgpack = require('../')
var bl = require('bl')

test('encoding/decoding 32-bits float numbers', function (t) {
  var encoder = msgpack()
  var float32 = [
    1.5,
    0.15625,
    -2.5
  ]

  var float64 = [
    2 ** 150,
    1.337,
    2.2
  ]

  float64.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 9, 'must have 5 bytes')
      t.equal(buf[0], 0xcb, 'must have the proper header')

      var dec = buf.readDoubleBE(1)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('decoding ' + num, function (t) {
      var buf = Buffer.allocUnsafe(9)
      var dec
      buf[0] = 0xcb
      buf.writeDoubleBE(num, 1)

      dec = encoder.decode(buf)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('mirror test ' + num, function (t) {
      var dec = encoder.decode(encoder.encode(num))
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })
  })

  float32.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 5, 'must have 5 bytes')
      t.equal(buf[0], 0xca, 'must have the proper header')

      var dec = buf.readFloatBE(1)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('forceFloat64 encoding ' + num, function (t) {
      var enc = msgpack({ forceFloat64: true })
      var buf = enc.encode(num)

      t.equal(buf.length, 9, 'must have 9 bytes')
      t.equal(buf[0], 0xcb, 'must have the proper header')

      var dec = buf.readDoubleBE(1)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('decoding ' + num, function (t) {
      var buf = Buffer.allocUnsafe(5)
      var dec
      buf[0] = 0xca
      buf.writeFloatBE(num, 1)

      dec = encoder.decode(buf)
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })

    t.test('mirror test ' + num, function (t) {
      var dec = encoder.decode(encoder.encode(num))
      t.equal(dec, num, 'must decode correctly')
      t.end()
    })
  })

  t.end()
})

test('decoding an incomplete 32-bits float numbers', function (t) {
  var encoder = msgpack()
  var buf = Buffer.allocUnsafe(4)
  buf[0] = 0xca
  buf = bl().append(buf)
  var origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})

test('decoding an incomplete 64-bits float numbers', function (t) {
  var encoder = msgpack()
  var buf = Buffer.allocUnsafe(8)
  buf[0] = 0xcb
  buf = bl().append(buf)
  var origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
