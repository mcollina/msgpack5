'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

test('encoding/decoding 64-bits float numbers', function (t) {
  const encoder = msgpack()
  const allNum = []

  allNum.push(748365544534.2)
  allNum.push(-222111111000004.2)
  allNum.push(9007199254740992)
  allNum.push(-9007199254740992)

  allNum.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      const dec = buf.readDoubleBE(1)
      t.equal(buf.length, 9, 'must have 9 bytes')
      t.equal(buf[0], 0xcb, 'must have the proper header')
      t.true(Math.abs(dec - num) < 0.1, 'must decode correctly')
      t.end()
    })

    t.test('decoding ' + num, function (t) {
      const buf = Buffer.allocUnsafe(9)
      buf[0] = 0xcb
      buf.writeDoubleBE(num, 1)
      const dec = encoder.decode(buf)
      t.true(Math.abs(dec - num) < 0.1, 'must decode correctly')
      t.end()
    })

    t.test('mirror test ' + num, function (t) {
      const dec = encoder.decode(encoder.encode(num))
      t.true(Math.abs(dec - num) < 0.1, 'must decode correctly')
      t.end()
    })
  })

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
