'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')
const base = 100000

function build (size, value) {
  const map = {}

  for (let i = 0; i < size; i++) {
    map[i + base] = value
  }

  return map
}

function computeLength (mapLength) {
  let length = 3 // the header
  const multi = ('' + base).length + 1 + 1 // we have <base + 1> bytes for each key, plus 1 byte for the value

  length += mapLength * multi

  return length
}

test('encode/decode maps up to 2^16-1 elements', function (t) {
  const encoder = msgpack()

  function doTest (length) {
    const map = build(length, 42)
    const buf = encoder.encode(map)

    t.test('encoding a map with ' + length + ' elements of ' + map[base], function (t) {
      // the map is full of 1-byte integers
      t.equal(buf.length, computeLength(length), 'must have the right length')
      t.equal(buf.readUInt8(0), 0xde, 'must have the proper header')
      t.equal(buf.readUInt16BE(1), length, 'must include the map length')
      t.end()
    })

    t.test('mirror test for a map of length ' + length + ' with ' + map[base], function (t) {
      t.deepEqual(encoder.decode(buf), map, 'must stay the same')
      t.end()
    })
  }

  doTest(Math.pow(2, 8))
  doTest(Math.pow(2, 8) + 1)
  doTest(Math.pow(2, 12) + 1)
  // too slow
  // doTest(Math.pow(2, 16) - 1)

  t.end()
})

test('decoding a chopped map', function (t) {
  const encoder = msgpack()
  const map = encoder.encode(build(Math.pow(2, 12) + 1, 42))
  let buf = Buffer.allocUnsafe(map.length)
  buf[0] = 0xde
  buf.writeUInt16BE(Math.pow(2, 16) - 1, 1) // set bigger size
  map.copy(buf, 3, 3, map.length)
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})

test('decoding an incomplete header of a map', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(2)
  buf[0] = 0xde
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
