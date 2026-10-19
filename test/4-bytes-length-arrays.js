'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

function build (size) {
  const array = []

  for (let i = 0; i < size; i++) {
    array.push(42)
  }

  return array
}

test('encode/decode arrays up to 0xffffffff elements', async function (t) {
  const encoder = msgpack()

  async function doTest (array) {
    await t.test('encoding an array with ' + array.length + ' elements', async function (t) {
      const buf = encoder.encode(array)
      // the array is full of 1-byte integers
      t.assert.strictEqual(buf.length, 5 + array.length, 'must have the right length')
      t.assert.strictEqual(buf.readUInt8(0), 0xdd, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt32BE(1), array.length, 'must include the array length')
    })

    await t.test('mirror test for an array of length ' + array.length, async function (t) {
      t.assert.deepStrictEqual(encoder.decode(encoder.encode(array)), array, 'must stay the same')
    })
  }

  await doTest(build(0xffff + 1))
  await doTest(build(0xffff + 42))
  // unable to test bigger arrays do to out of memory errors
})

test('decoding an incomplete array', async function (t) {
  const encoder = msgpack()

  const array = build(0xffff + 42)
  let buf = Buffer.allocUnsafe(5 + array.length)
  buf[0] = 0xdd
  buf.writeUInt32BE(array.length + 10, 1) // set bigger size
  let pos = 5
  for (let i = 0; i < array.length; i++) {
    const obj = encoder.encode(array[i], true)
    obj.copy(buf, pos)
    pos += obj.length
  }
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})

test('decoding an incomplete header', async function (t) {
  const encoder = msgpack()

  let buf = Buffer.allocUnsafe(4)
  buf[0] = 0xdd
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
