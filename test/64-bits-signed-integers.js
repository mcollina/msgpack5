'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encoding/decoding 64-bits big-endian signed integers', function (t) {
  const encoder = msgpack()
  const table = [
    { num: -9007199254740991, hi: 0xffe00000, lo: 0x00000001 },
    { num: -4294967297, hi: 0xfffffffe, lo: 0xffffffff },
    { num: -4294967296, hi: 0xffffffff, lo: 0x00000000 },
    { num: -4294967295, hi: 0xffffffff, lo: 0x00000001 },
    { num: -214748365, hi: 0xffffffff, lo: 0xf3333333 }
  ]

  table.forEach(function (testCase) {
    t.test('encoding ' + testCase.num, function (t) {
      const buf = encoder.encode(testCase.num)
      t.assert.strictEqual(buf.length, 9, 'must have 9 bytes')
      t.assert.strictEqual(buf[0], 0xd3, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt32BE(1), testCase.hi, 'hi word must be properly written')
      t.assert.strictEqual(buf.readUInt32BE(5), testCase.lo, 'lo word must be properly written')
    })

    t.test('mirror test ' + testCase.num, function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(testCase.num)), testCase.num, 'must stay the same')
    })
  })
})

test('decoding a negative 64-bits integer does not mutate the input', function (t) {
  const encoder = msgpack()
  const encoded = Buffer.from([0xd3, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe])
  const expected = encoded.toString('hex')

  t.assert.strictEqual(encoder.decode(encoded), -2, 'decodes a direct buffer')
  t.assert.strictEqual(encoded.toString('hex'), expected, 'does not mutate a direct buffer')
  t.assert.strictEqual(encoder.decode(encoded), -2, 'decodes the same buffer consistently')
  t.assert.strictEqual(encoded.toString('hex'), expected, 'leaves the buffer unchanged after repeated decoding')

  const singleChunk = Buffer.from(encoded)
  t.assert.strictEqual(encoder.decode(new DynamicBuffer().append(singleChunk)), -2, 'decodes a single-chunk BufferList')
  t.assert.strictEqual(singleChunk.toString('hex'), expected, 'does not mutate the underlying chunk')

  const firstChunk = Buffer.from(encoded.slice(0, 4))
  const secondChunk = Buffer.from(encoded.slice(4))
  t.assert.strictEqual(encoder.decode(new DynamicBuffer().append(firstChunk).append(secondChunk)), -2, 'decodes a split-chunk BufferList')
  t.assert.strictEqual(Buffer.concat([firstChunk, secondChunk]).toString('hex'), expected, 'does not mutate split chunks')
})

test('decoding an incomplete 64-bits big-endian signed integer', function (t) {
  const encoder = msgpack()
  let buf = Buffer.allocUnsafe(8)
  buf[0] = 0xd3
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
