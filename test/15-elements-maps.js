'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const bl = require('bl')

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

test('encode/decode maps up to 15 elements', function (t) {
  const encoder = msgpack()
  const all = []
  let i

  for (i = 0; i < 16; i++) {
    all.push(build(i, 42))
  }

  for (i = 0; i < 16; i++) {
    all.push(build(i, 'aaa'))
  }

  all.forEach(function (map) {
    const length = Object.keys(map).length
    t.test('encoding a map with ' + length + ' elements of ' + map[100], function (t) {
      const buf = encoder.encode(map)
      t.equal(buf.length, computeLength(map), 'must have the right length')
      t.equal(buf.readUInt8(0) & 0xf0, 0x80, 'must have the proper header')
      t.equal(buf.readUInt8(0) & 0x0f, length, 'must include the map length')
      t.end()
    })

    t.test('mirror test for a map of length ' + length + ' with ' + map[100], function (t) {
      t.deepEqual(encoder.decode(encoder.encode(map)), map, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

test('do not encode undefined in a map', function (t) {
  const instance = msgpack()
  const expected = { hello: 'world' }
  const toEncode = { a: undefined, hello: 'world' }
  const buf = instance.encode(toEncode)

  t.deepEqual(expected, instance.decode(buf), 'must ignore undefined')
  t.end()
})

test('encode NaN in a map', function (t) {
  const instance = msgpack()
  const toEncode = { a: NaN, hello: 'world' }

  const buf = instance.encode(toEncode)

  t.assert(Object.is(instance.decode(buf).a, NaN))

  const expected = { ...toEncode }
  delete toEncode.a
  const actual = instance.decode(buf)
  delete buf.a

  t.deepEqual(actual, expected)

  t.end()
})

test('encode/decode map with buf, ints and strings', function (t) {
  const map = {
    topic: 'hello',
    qos: 1,
    payload: Buffer.from('world'),
    messageId: '42',
    ttl: 1416309270167
  }
  const pack = msgpack()

  t.deepEqual(pack.decode(pack.encode(map)), map)
  t.end()
})

test('decoding a chopped map', function (t) {
  const encoder = msgpack()
  const map = encoder.encode({ a: 'b', c: 'd', e: 'f' })
  let buf = Buffer.allocUnsafe(map.length)
  buf[0] = 0x80 | 5 // set bigger size
  map.copy(buf, 1, 1, map.length)
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    encoder.decode(buf)
  }, encoder.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
