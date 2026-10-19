'use strict'

const test = require('node:test')
const msgpack = require('../')

test('decode throws when object has forbidden __proto__ property', function (t) {
  const encoder = msgpack()

  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const encoded = encoder.encode(payload)

  t.assert.throws(() => encoder.decode(encoded), /Object contains forbidden prototype property/)
})

test('decode defaults protoAction with partial options', function (t) {
  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const encoded = msgpack().encode(payload)
  const options = [
    {},
    { forceFloat64: true },
    { compatibilityMode: true },
    { disableTimestampEncoding: true },
    { preferMap: false },
    { sortKeys: true },
    { protoAction: undefined }
  ]

  options.forEach(function (opts) {
    t.assert.throws(function () {
      msgpack(opts).decode(encoded)
    }, /Object contains forbidden prototype property/)
  })
  t.assert.strictEqual({}.polluted, undefined, 'does not affect Object.prototype')
})

test('does not mutate the caller options object', function (t) {
  const options = { forceFloat64: true }
  msgpack(options)

  t.assert.strictEqual(options.protoAction, undefined)
})

test('validates protoAction', function (t) {
  const invalid = [null, false, '', 'typo']

  invalid.forEach(function (protoAction) {
    t.assert.throws(function () {
      msgpack({ protoAction })
    }, /protoAction must be "error", "remove", or "ignore"/)
  })
})

test('decode ignores forbidden __proto__ property if protoAction is "ignore"', function (t) {
  const encoder = msgpack({ protoAction: 'ignore' })

  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const decoded = encoder.decode(encoder.encode(payload))

  t.assert.strictEqual(decoded.polluted, true)
  t.assert.notStrictEqual(Object.getPrototypeOf(decoded), Object.prototype)
  t.assert.ok(!Object.prototype.hasOwnProperty.call(decoded, 'polluted'))
  t.assert.strictEqual({}.polluted, undefined, 'does not affect Object.prototype')
})

test('decode removes forbidden __proto__ property if protoAction is "remove"', function (t) {
  const encoder = msgpack({ protoAction: 'remove' })

  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const decoded = encoder.decode(encoder.encode(payload))

  t.assert.strictEqual(decoded.polluted, undefined)
  t.assert.strictEqual(Object.getPrototypeOf(decoded), Object.prototype)
})
