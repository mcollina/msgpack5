'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
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

  t.assert.strictEqual(array, null, 'decodes arrays at the limit')
  t.assert.strictEqual(map, null, 'decodes maps at the limit')
  t.assert.throws(function () {
    pack.decode(nestedArray(101))
  }, /Maximum decode depth exceeded/, 'rejects arrays over the limit')
  t.assert.throws(function () {
    pack.decode(nestedMap(101))
  }, /Maximum decode depth exceeded/, 'rejects maps over the limit')
})

test('supports a custom maximum nesting depth', function (t) {
  const pack = msgpack({ maxDepth: 2 })

  t.assert.doesNotThrow(function () {
    pack.decode(nestedArray(2))
  }, 'decodes input at the configured limit')
  t.assert.throws(function () {
    pack.decode(nestedArray(3))
  }, /Maximum decode depth exceeded/, 'rejects input over the configured limit')
})

test('defaults maxDepth when other options are provided', function (t) {
  const pack = msgpack({ forceFloat64: true })

  t.assert.throws(function () {
    pack.decode(nestedArray(101))
  }, /Maximum decode depth exceeded/)
})

test('allows scalars but no containers when maxDepth is zero', function (t) {
  const pack = msgpack({ maxDepth: 0 })

  t.assert.strictEqual(pack.decode(Buffer.from([0xc0])), null, 'decodes a scalar')
  t.assert.throws(function () {
    pack.decode(Buffer.from([0x90]))
  }, /Maximum decode depth exceeded/, 'rejects an empty container')
})

test('validates maxDepth', function (t) {
  const invalid = [-1, 1.5, Infinity, NaN, '100', null]

  invalid.forEach(function (maxDepth) {
    t.assert.throws(function () {
      msgpack({ maxDepth })
    }, /maxDepth must be a non-negative integer/)
  })
})

test('reports a controlled error from the decoder stream', async function (t) {
  t.plan(2)

  const decoder = msgpack().decoder()
  const done = new Promise((resolve, reject) => {
    decoder.on('error', function (err) {
      t.assert.strictEqual(err.message, 'Maximum decode depth exceeded')
      t.assert.ok(!(err instanceof RangeError), 'does not exhaust the native stack')
      resolve()
    })
  })
  decoder.end(nestedArray(101))
  await done
})
