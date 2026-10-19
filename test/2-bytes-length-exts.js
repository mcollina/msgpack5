'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('encode/decode variable ext data up between 0x0100 and 0xffff', async function (t) {
  const encoder = msgpack()
  const all = []

  function MyType (size, value) {
    this.value = value
    this.size = size
  }

  function mytipeEncode (obj) {
    const buf = Buffer.allocUnsafe(obj.size)
    buf.fill(obj.value)
    return buf
  }

  function mytipeDecode (data) {
    const result = new MyType(data.length, data.toString('utf8', 0, 1))

    for (let i = 0; i < data.length; i++) {
      if (data.readUInt8(0) !== data.readUInt8(i)) {
        throw new Error('should all be the same')
      }
    }

    return result
  }

  encoder.register(0x42, MyType, mytipeEncode, mytipeDecode)

  all.push(new MyType(0x0100, 'a'))
  all.push(new MyType(0x0101, 'a'))
  all.push(new MyType(0xffff, 'a'))

  for (const orig of all) {
    await t.test('encoding a custom obj of length ' + orig.size, async function (t) {
      const buf = encoder.encode(orig)
      t.assert.strictEqual(buf.length, 4 + orig.size, 'must have the right length')
      t.assert.strictEqual(buf.readUInt8(0), 0xc8, 'must have the ext header')
      t.assert.strictEqual(buf.readUInt16BE(1), orig.size, 'must include the data length')
      t.assert.strictEqual(buf.readUInt8(3), 0x42, 'must include the custom type id')
      t.assert.strictEqual(buf.toString('utf8', 4, 5), orig.value, 'must decode correctly')
    })

    await t.test('mirror test with a custom obj of length ' + orig.size, async function (t) {
      t.assert.deepStrictEqual(encoder.decode(encoder.encode(orig)), orig, 'must stay the same')
    })
  }

  await t.test('decoding an incomplete variable ext data up between 0x0100 and 0xffff', async function (t) {
    const obj = encoder.encode(new MyType(0xfff0, 'a'))
    let buf = Buffer.allocUnsafe(obj.length)
    buf[0] = 0xc8
    buf.writeUInt16BE(obj.length + 2, 1) // set bigger size
    obj.copy(buf, 3, 3, obj.length)
    buf = new DynamicBuffer().append(buf)
    const origLength = buf.length
    t.assert.throws(function () {
      encoder.decode(buf)
    }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
    t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
  })

  await t.test('decoding an incomplete header of variable ext data up between 0x0100 and 0xffff', async function (t) {
    let buf = Buffer.allocUnsafe(3)
    buf[0] = 0xc8
    buf = new DynamicBuffer().append(buf)
    const origLength = buf.length
    t.assert.throws(function () {
      encoder.decode(buf)
    }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
    t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
  })
})
