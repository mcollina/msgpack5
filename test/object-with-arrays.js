'use strict'

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

test('decoding a map with multiple big arrays', function (t) {
  const map = {
    first: build(0xffff + 42),
    second: build(0xffff + 42)
  }
  const pack = msgpack()

  t.deepEqual(pack.decode(pack.encode(map)), map)
  t.end()
})

test('decoding a map with multiple big arrays. First one is incomplete', function (t) {
  const array = build(0xffff + 42)
  const map = {
    first: array,
    second: build(0xffff + 42)
  }
  const pack = msgpack()

  let buf = pack.encode(map)
  // 1 (fixmap's header 0x82) + first key's length + 1 (first array's 0xdd)
  const sizePosOfFirstArray = 1 + pack.encode('first').length + 1
  buf.writeUInt32BE(array.length + 10, sizePosOfFirstArray) // set first array's size bigger than its actual size
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    pack.decode(buf)
  }, pack.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})

test('decoding a map with multiple big arrays. Second one is incomplete', function (t) {
  const array = build(0xffff + 42)
  const map = {
    first: array,
    second: build(0xffff + 42)
  }
  const pack = msgpack()

  let buf = pack.encode(map)
  // 1 (fixmap's header 0x82) + first key-value pair's length + second key's length + 1 (second array's 0xdd)
  const sizePosOfSecondArray = 1 + pack.encode('first').length + pack.encode(array).length + pack.encode('second').length + 1
  buf.writeUInt32BE(array.length + 10, sizePosOfSecondArray) // set second array's size bigger than its actual size
  buf = bl().append(buf)
  const origLength = buf.length
  t.throws(function () {
    pack.decode(buf)
  }, pack.IncompleteBufferError, 'must throw IncompleteBufferError')
  t.equals(buf.length, origLength, 'must not consume any byte')
  t.end()
})
