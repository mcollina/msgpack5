'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

function build (size) {
  const array = []
  let i

  for (i = 0; i < size; i++) {
    array.push(42)
  }

  return array
}

test('encode/decode arrays up to 0xffff elements', function (t) {
  const encoder = msgpack()
  const all = []
  let i

  for (i = 16; i < 0xffff; i += 4242) {
    all.push(build(i))
  }

  all.push(build(0xff))
  all.push(build(0xffff))

  all.forEach(function (array) {
    t.test('encoding an array with ' + array.length + ' elements', function (t) {
      const buf = encoder.encode(array)
      // the array is full of 1-byte integers
      t.equal(buf.length, 3 + array.length, 'must have the right length')
      t.equal(buf.readUInt8(0), 0xdc, 'must have the proper header')
      t.equal(buf.readUInt16BE(1), array.length, 'must include the array length')
      t.end()
    })

    t.test('mirror test for an array of length ' + array.length, function (t) {
      t.deepEqual(encoder.decode(encoder.encode(array)), array, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

test('decoding an incomplete array', function (t) {
  const encoder = msgpack()

  const array = build(0xffff / 2)
  let buf = Buffer.allocUnsafe(3 + array.length)
  buf[0] = 0xdc
  buf.writeUInt16BE(array.length + 10, 1) // set bigger size
  let pos = 3
  for (let i = 0; i < array.length; i++) {
    const obj = encoder.encode(array[i], true)
    obj.copy(buf, pos)
    pos += obj.length
  }
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(origLength, buf.length, 'must not consume any byte')
  t.end()
})

test('decoding an incomplete header', function (t) {
  const encoder = msgpack()

  let buf = Buffer.allocUnsafe(2)
  buf[0] = 0xdc
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
