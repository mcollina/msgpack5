'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

test('encode/decode ext with a custom object check', function (t) {
  const encoder = msgpack()
  const all = []

  function MyType (data) {
    this.data = data
  }

  function checkForMyType (obj) {
    return obj instanceof MyType
  }

  function mytypeEncode (obj) {
    const buf = Buffer.allocUnsafe(2)
    buf.writeUInt8(0x42, 0)
    buf.writeUInt8(obj.data, 1)
    return buf
  }

  function mytypeDecode (data) {
    return new MyType(data.readUInt8(0))
  }

  encoder.registerEncoder(checkForMyType, mytypeEncode)
  encoder.registerDecoder(0x42, mytypeDecode)

  all.push(new MyType(0))
  all.push(new MyType(1))
  all.push(new MyType(42))

  all.forEach(function (orig) {
    t.test('encoding a custom obj encoded as ' + orig.data, function (t) {
      const buf = encoder.encode(orig)
      t.assert.strictEqual(buf.length, 3, 'must have the right length')
      t.assert.strictEqual(buf.readUInt8(0), 0xd4, 'must have the fixext header')
      t.assert.strictEqual(buf.readUInt8(1), 0x42, 'must include the custom type id')
      t.assert.strictEqual(buf.readUInt8(2), orig.data, 'must decode correctly')
    })

    t.test('decoding a custom obj encoded as ' + orig.data, function (t) {
      const buf = Buffer.allocUnsafe(3)
      buf[0] = 0xd4
      buf[1] = 0x42
      buf.writeUInt8(orig.data, 2)
      t.assert.deepStrictEqual(encoder.decode(buf), orig, 'must decode correctly')
      t.assert.ok(encoder.decode(buf) instanceof MyType, 'must have the correct prototype')
    })

    t.test('mirror test with a custom obj containing ' + orig.data, function (t) {
      t.assert.deepStrictEqual(encoder.decode(encoder.encode(orig)), orig, 'must stay the same')
    })
  })
})
