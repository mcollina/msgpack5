'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')

function nestedArray (depth) {
  return Buffer.concat([Buffer.alloc(depth, 0x91), Buffer.from([0xc0])])
}

function nestedMap (depth) {
  const prefix = Buffer.alloc(depth * 3)

  for (let i = 0; i < depth; i++) {
    prefix[i * 3] = 0x81
    prefix[i * 3 + 1] = 0xa1
    prefix[i * 3 + 2] = 0x78
  }

  return Buffer.concat([prefix, Buffer.from([0xc0])])
}

test('limits array and map nesting depth by default', function (t) {
  const pack = msgpack()
  let array = pack.decode(nestedArray(100))
  let map = pack.decode(nestedMap(100))

  for (let i = 0; i < 100; i++) {
    array = array[0]
    map = map.x
  }

  t.equal(array, null, 'decodes arrays at the limit')
  t.equal(map, null, 'decodes maps at the limit')
  t.throws(function () {
    pack.decode(nestedArray(101))
  }, /Maximum decode depth exceeded/, 'rejects arrays over the limit')
  t.throws(function () {
    pack.decode(nestedMap(101))
  }, /Maximum decode depth exceeded/, 'rejects maps over the limit')
  t.end()
})

test('supports a custom maximum nesting depth', function (t) {
  const pack = msgpack({ maxDepth: 2 })

  t.doesNotThrow(function () {
    pack.decode(nestedArray(2))
  }, 'decodes input at the configured limit')
  t.throws(function () {
    pack.decode(nestedArray(3))
  }, /Maximum decode depth exceeded/, 'rejects input over the configured limit')
  t.end()
})

test('defaults maxDepth when other options are provided', function (t) {
  const pack = msgpack({ forceFloat64: true })

  t.throws(function () {
    pack.decode(nestedArray(101))
  }, /Maximum decode depth exceeded/)
  t.end()
})

test('allows scalars but no containers when maxDepth is zero', function (t) {
  const pack = msgpack({ maxDepth: 0 })

  t.equal(pack.decode(Buffer.from([0xc0])), null, 'decodes a scalar')
  t.throws(function () {
    pack.decode(Buffer.from([0x90]))
  }, /Maximum decode depth exceeded/, 'rejects an empty container')
  t.end()
})

test('validates maxDepth', function (t) {
  const invalid = [-1, 1.5, Infinity, NaN, '100', null]

  invalid.forEach(function (maxDepth) {
    t.throws(function () {
      msgpack({ maxDepth })
    }, /maxDepth must be a non-negative integer/)
  })
  t.end()
})

test('reports a controlled error from the decoder stream', function (t) {
  t.plan(2)

  const decoder = msgpack().decoder()
  decoder.on('error', function (err) {
    t.equal(err.message, 'Maximum decode depth exceeded')
    t.notOk(err instanceof RangeError, 'does not exhaust the native stack')
  })
  decoder.end(nestedArray(101))
})
