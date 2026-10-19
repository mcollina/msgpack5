'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

function build (size) {
  const buf = Buffer.allocUnsafe(size)
  buf.fill('a')

  return buf
}

test('encode/decode 2^8-1 bytes buffers', async function (t) {
  const encoder = msgpack()
  const all = []

  all.push(build(Math.pow(2, 8) - 1))
  all.push(build(Math.pow(2, 6) + 1))
  all.push(build(1))
  all.push(Buffer.allocUnsafe(0))

  for (const orig of all) {
    await t.test('encoding a buffer of length ' + orig.length, async function (t) {
      const buf = encoder.encode(orig)
      t.assert.strictEqual(buf.length, 2 + orig.length, 'must have the right length')
      t.assert.strictEqual(buf.readUInt8(0), 0xc4, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt8(1), orig.length, 'must include the buf length')
      t.assert.strictEqual(buf.toString('utf8', 2), orig.toString('utf8'), 'must decode correctly')
    })

    await t.test('decoding a buffer of length ' + orig.length, async function (t) {
      const buf = Buffer.allocUnsafe(2 + orig.length)
      buf[0] = 0xc4
      buf[1] = orig.length
      orig.copy(buf, 2)
      t.assert.strictEqual(encoder.decode(buf).toString('utf8'), orig.toString('utf8'), 'must decode correctly')
    })

    await t.test('mirror test a buffer of length ' + orig.length, async function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(orig)).toString(), orig.toString(), 'must stay the same')
    })
  }
})

test('decoding a chopped 2^8-1 bytes buffer', async function (t) {
  const encoder = msgpack()
  const orig = build(Math.pow(2, 6))
  let buf = Buffer.allocUnsafe(2 + orig.length)
  buf[0] = 0xc4
  buf[1] = Math.pow(2, 8) - 1 // set bigger size
  orig.copy(buf, 2)
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})

test('decoding an incomplete header of 2^8-1 bytes buffer', async function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(1)
  buf[0] = 0xc4
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
