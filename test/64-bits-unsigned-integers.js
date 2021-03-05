'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

test('encoding/decoding 64-bits big-endian unsigned integers', function (t) {
  const encoder = msgpack()
  const allNum = []

  allNum.push(0x0000000100000000)
  allNum.push(0xffffffffeeeee)

  allNum.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      t.equal(buf.length, 9, 'must have 9 bytes')
      t.equal(buf[0], 0xcf, 'must have the proper header')
      let result = 0
      for (let k = 7; k >= 0; k--) {
        result += (buf.readUInt8(k + 1) * Math.pow(2, (8 * (7 - k))))
      }
      t.equal(result, num, 'must decode correctly')
      t.end()
    })

    t.test('mirror test ' + num, function (t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

test('decoding an incomplete 64-bits big-endian unsigned integer', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(8)
  buf[0] = 0xcf
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
