'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encode/decode 2^8 <-> (2^16-1) bytes strings', async function (t) {
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

  for (const str of all) {
    await t.test('encoding a string of length ' + str.length, async function (t) {
      const buf = encoder.encode(str)
      t.assert.strictEqual(buf.length, 3 + Buffer.byteLength(str), 'must be the proper length')
      t.assert.strictEqual(buf[0], 0xda, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt16BE(1), Buffer.byteLength(str), 'must include the str length')
      t.assert.strictEqual(buf.toString('utf8', 3, Buffer.byteLength(str) + 3), str, 'must decode correctly')
    })

    await t.test('decoding a string of length ' + str.length, async function (t) {
      const buf = Buffer.allocUnsafe(3 + Buffer.byteLength(str))
      buf[0] = 0xda
      buf.writeUInt16BE(Buffer.byteLength(str), 1)
      buf.write(str, 3)
      t.assert.strictEqual(encoder.decode(buf), str, 'must decode correctly')
    })

    await t.test('mirror test a string of length ' + str.length, async function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(str)), str, 'must stay the same')
    })
  }
})

test('decoding a chopped string', async function (t) {
  const encoder = msgpack()
  let str
  for (str = 'a'; str.length < 0xff + 100;) {
    str += 'a'
  }
  let buf = Buffer.allocUnsafe(3 + Buffer.byteLength(str))
  buf[0] = 0xda
  buf.writeUInt16BE(Buffer.byteLength(str) + 10, 1) // set bigger size
  buf.write(str, 3)
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})

test('decoding an incomplete header of a string', async function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(2)
  buf[0] = 0xda
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
