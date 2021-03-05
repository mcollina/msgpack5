'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

test('encode/decode strings with max 31 of length', function (t) {
  const encoder = msgpack()
  const all = []

  // build base
  for (let i = ''; i.length < 32; i += 'a') {
    all.push(i)
  }

  all.forEach(function (str) {
    t.test('encoding a string of length ' + str.length, function (t) {
      const buf = encoder.encode(str)
      t.equal(buf.length, 1 + Buffer.byteLength(str), 'must be the proper length')
      t.equal(buf.readUInt8(0) & 0xe0, 0xa0, 'must have the proper header')
      t.equal(buf.readUInt8(0) & 0x1f, Buffer.byteLength(str), 'must include the str length')
      t.equal(buf.toString('utf8', 1, Buffer.byteLength(str) + 2), str, 'must decode correctly')
      t.end()
    })

    t.test('decoding a string of length ' + str.length, function (t) {
      const buf = Buffer.allocUnsafe(1 + Buffer.byteLength(str))
      buf[0] = 0xa0 | Buffer.byteLength(str)
      if (str.length > 0) {
        buf.write(str, 1)
      }
      t.equal(encoder.decode(buf), str, 'must decode correctly')
      t.end()
    })

    t.test('mirror test a string of length ' + str.length, function (t) {
      t.equal(encoder.decode(encoder.encode(str)), str, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

test('decoding a chopped string', function (t) {
  const encoder = msgpack()
  const str = 'aaa'
  let buf = Buffer.allocUnsafe(1 + Buffer.byteLength(str))
  buf[0] = 0xa0 | Buffer.byteLength(str) + 2 // set bigger size
  buf.write(str, 1)
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
