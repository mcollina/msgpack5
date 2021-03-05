'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

test('encoding/decoding 32-bits big-endian signed integers', function (t) {
  const encoder = msgpack()
  const allNum = []

  for (let i = 32769; i < 214748364; i += 10235023) {
    allNum.push(-i)
  }

  allNum.push(-214748364)

  allNum.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      t.equal(buf.length, 5, 'must have 5 bytes')
      t.equal(buf[0], 0xd2, 'must have the proper header')
      t.equal(buf.readInt32BE(1), num, 'must decode correctly')
      t.end()
    })

    t.test('decoding ' + num, function (t) {
      const buf = Buffer.allocUnsafe(5)
      buf[0] = 0xd2
      buf.writeInt32BE(num, 1)
      t.equal(encoder.decode(buf), num, 'must decode correctly')
      t.end()
    })

    t.test('mirror test ' + num, function (t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

test('decoding an incomplete 32-bits big-endian integer', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(4)
  buf[0] = 0xd2
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
