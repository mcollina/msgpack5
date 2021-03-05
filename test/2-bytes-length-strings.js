'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

test('encode/decode 2^8 <-> (2^16-1) bytes strings', function (t) {
  const encoder = msgpack()
  const all = []
  let str

  str = Buffer.allocUnsafe(Math.pow(2, 8))
  str.fill('a')
  all.push(str.toString())

  str = Buffer.allocUnsafe(Math.pow(2, 8) + 1)
  str.fill('a')
  all.push(str.toString())

  str = Buffer.allocUnsafe(Math.pow(2, 14))
  str.fill('a')
  all.push(str.toString())

  str = Buffer.allocUnsafe(Math.pow(2, 16) - 1)
  str.fill('a')
  all.push(str.toString())

  all.forEach(function (str) {
    t.test('encoding a string of length ' + str.length, function (t) {
      const buf = encoder.encode(str)
      t.equal(buf.length, 3 + Buffer.byteLength(str), 'must be the proper length')
      t.equal(buf[0], 0xda, 'must have the proper header')
      t.equal(buf.readUInt16BE(1), Buffer.byteLength(str), 'must include the str length')
      t.equal(buf.toString('utf8', 3, Buffer.byteLength(str) + 3), str, 'must decode correctly')
      t.end()
    })

    t.test('decoding a string of length ' + str.length, function (t) {
      const buf = Buffer.allocUnsafe(3 + Buffer.byteLength(str))
      buf[0] = 0xda
      buf.writeUInt16BE(Buffer.byteLength(str), 1)
      buf.write(str, 3)
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
  let str
  for (str = 'a'; str.length < 0xff + 100;) {
    str += 'a'
  }
  let buf = Buffer.allocUnsafe(3 + Buffer.byteLength(str))
  buf[0] = 0xda
  buf.writeUInt16BE(Buffer.byteLength(str) + 10, 1) // set bigger size
  buf.write(str, 3)
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})

test('decoding an incomplete header of a string', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(2)
  buf[0] = 0xda
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
