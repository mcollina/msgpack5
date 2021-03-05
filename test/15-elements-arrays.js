'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

function build (size, obj) {
  const array = []
  let i

  for (i = 0; i < size; i++) {
    array.push(obj)
  }

  return array
}

function computeLength (array) {
  let length = 1 // the header
  let multi = 1

  if (array[0] && typeof array[0] === 'string') {
    multi += array[0].length
  }

  length += array.length * multi

  return length
}

test('encode/decode arrays up to 15 elements', function (t) {
  const encoder = msgpack()
  const all = []
  let i

  for (i = 0; i < 16; i++) {
    all.push(build(i, 42))
  }

  for (i = 0; i < 16; i++) {
    all.push(build(i, 'aaa'))
  }

  all.forEach(function (array) {
    t.test('encoding an array with ' + array.length + ' elements of ' + array[0], function (t) {
      const buf = encoder.encode(array)
      // the array is full of 1-byte integers
      t.equal(buf.length, computeLength(array), 'must have the right length')
      t.equal(buf.readUInt8(0) & 0xf0, 0x90, 'must have the proper header')
      t.equal(buf.readUInt8(0) & 0x0f, array.length, 'must include the array length')
      t.end()
    })

    t.test('mirror test for an array of length ' + array.length + ' with ' + array[0], function (t) {
      t.deepEqual(encoder.decode(encoder.encode(array)), array, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

test('decoding an incomplete array', function (t) {
  const encoder = msgpack()

  const array = ['a', 'b', 'c']
  const size = computeLength(array)
  let buf = Buffer.allocUnsafe(size)
  buf[0] = 0x90 | array.length + 2 // set bigger size
  let pos = 1
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
