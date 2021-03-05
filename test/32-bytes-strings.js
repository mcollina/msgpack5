'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')

test('encode/decode up to 31 bytes strings', function (t) {
  const encoder = msgpack()
  const all = []

  for (let i = 'a'; i.length < 32; i += 'a') {
    all.push(i)
  }

  all.forEach(function (str) {
    t.test('encoding a string of length ' + str.length, function (t) {
      const buf = encoder.encode(str)
      t.equal(buf.length, 1 + Buffer.byteLength(str), 'must have 2 bytes')
      t.equal(buf[0] & 0xe0, 0xa0, 'must have the proper header')
      t.equal(buf.toString('utf8', 1, Buffer.byteLength(str) + 1), str, 'must decode correctly')
      t.end()
    })

    t.test('decoding a string of length ' + str.length, function (t) {
      const buf = Buffer.allocUnsafe(1 + Buffer.byteLength(str))
      buf[0] = 0xa0 | Buffer.byteLength(str)
      buf.write(str, 1)
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
