'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

function build (size, value) {
  const map = {}
  let i

  for (i = 0; i < size; i++) {
    map[i + 100 + ''] = value
  }

  return map
}

function computeLength (map) {
  let length = 1 // the header
  let multi = 5 // we have 4 bytes for each key, plus 1 byte for the value

  if (map[100] && typeof map[100] === 'string') {
    multi += map[100].length
  }

  length += Object.keys(map).length * multi

  return length
}

test('encode/decode maps up to 15 elements', async function (t) {
  const encoder = msgpack()
  const all = []
  let i

  for (i = 0; i < 16; i++) {
    all.push(build(i, 42))
  }

  for (i = 0; i < 16; i++) {
    all.push(build(i, 'aaa'))
  }

  for (const map of all) {
    const length = Object.keys(map).length
    await t.test('encoding a map with ' + length + ' elements of ' + map[100], async function (t) {
      const buf = encoder.encode(map)
      t.assert.strictEqual(buf.length, computeLength(map), 'must have the right length')
      t.assert.strictEqual(buf.readUInt8(0) & 0xf0, 0x80, 'must have the proper header')
      t.assert.strictEqual(buf.readUInt8(0) & 0x0f, length, 'must include the map length')
    })

    await t.test('mirror test for a map of length ' + length + ' with ' + map[100], async function (t) {
      t.assert.deepStrictEqual(encoder.decode(encoder.encode(map)), map, 'must stay the same')
    })
  }
})

test('do not encode undefined in a map', async function (t) {
  const instance = msgpack()
  const expected = { hello: 'world' }
  const toEncode = { a: undefined, hello: 'world' }
  const buf = instance.encode(toEncode)

  t.assert.deepStrictEqual(expected, instance.decode(buf), 'must ignore undefined')
})

test('encode NaN in a map', async function (t) {
  const instance = msgpack()
  const toEncode = { a: NaN, hello: 'world' }

  const buf = instance.encode(toEncode)

  t.assert.ok(Object.is(instance.decode(buf).a, NaN))

  const expected = { ...toEncode }
  delete toEncode.a
  const actual = instance.decode(buf)
  delete buf.a

  t.assert.deepStrictEqual(actual, expected)
})

test('encode/decode map with buf, ints and strings', async function (t) {
  const map = {
    topic: 'hello',
    qos: 1,
    payload: Buffer.from('world'),
    messageId: '42',
    ttl: 1416309270167
  }
  const pack = msgpack()

  t.assert.deepStrictEqual(pack.decode(pack.encode(map)), map)
})

test('decoding a chopped map', async function (t) {
  const encoder = msgpack()
  const map = encoder.encode({ a: 'b', c: 'd', e: 'f' })
  let buf = Buffer.allocUnsafe(map.length)
  buf[0] = 0x80 | 5 // set bigger size
  map.copy(buf, 1, 1, map.length)
  buf = new DynamicBuffer().append(buf)
  const origLength = buf.length
  t.assert.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.assert.strictEqual(buf.length, origLength, 'must not consume any byte')
})
