'use strict'

const test = require('tape').test
const msgpack = require('../')

test('encode/decode map with 10 keys', function (t) {
  const map = {}

  for (let i = 0; i < 10; i++) {
    map[i] = i
  }

  const pack = msgpack()

  const encoded = pack.encode(map)

  // map16 byte
  t.equal(encoded[0], 0x8A)

  t.deepEqual(pack.decode(encoded), map)
  t.end()
})

test('encode/decode map with 10000 keys', function (t) {
  const map = {}

  for (let i = 0; i < 10000; i++) {
    map[i] = i
  }

  const pack = msgpack()

  const encoded = pack.encode(map)

  // map16 byte
  t.equal(encoded[0], 0xde)

  t.deepEqual(pack.decode(encoded), map)
  t.end()
})

test('encode/decode map with 100000 keys', function (t) {
  const map = {}

  for (let i = 0; i < 100000; i++) {
    map[i] = i
  }

  const pack = msgpack()

  const encoded = pack.encode(map)

  // map32 byte
  t.equal(encoded[0], 0xdf)

  t.deepEqual(pack.decode(encoded), map)
  t.end()
})

test('encode/decode map with 1000000 keys', function (t) {
  const map = {}

  for (let i = 0; i < 1000000; i++) {
    map[i] = i
  }

  const pack = msgpack()

  t.deepEqual(pack.decode(pack.encode(map)), map)
  t.end()
})
