'use strict'

const test = require('tape').test
const msgpack = require('../')

test('decode throws when object has forbidden __proto__ property', function (t) {
  const encoder = msgpack()

  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const encoded = encoder.encode(payload)

  t.throws(() => encoder.decode(encoded), /Object contains forbidden prototype property/)
  t.end()
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
    t.throws(function () {
      msgpack(opts).decode(encoded)
    }, /Object contains forbidden prototype property/)
  })
  t.equal({}.polluted, undefined, 'does not affect Object.prototype')
  t.end()
})

test('does not mutate the caller options object', function (t) {
  const options = { forceFloat64: true }
  msgpack(options)

  t.equal(options.protoAction, undefined)
  t.end()
})

test('validates protoAction', function (t) {
  const invalid = [null, false, '', 'typo']

  invalid.forEach(function (protoAction) {
    t.throws(function () {
      msgpack({ protoAction })
    }, /protoAction must be "error", "remove", or "ignore"/)
  })
  t.end()
})

test('decode ignores forbidden __proto__ property if protoAction is "ignore"', function (t) {
  const encoder = msgpack({ protoAction: 'ignore' })

  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const decoded = encoder.decode(encoder.encode(payload))

  t.equal(decoded.polluted, true)
  t.notEqual(Object.getPrototypeOf(decoded), Object.prototype)
  t.notOk(Object.prototype.hasOwnProperty.call(decoded, 'polluted'))
  t.equal({}.polluted, undefined, 'does not affect Object.prototype')
  t.end()
})

test('decode removes forbidden __proto__ property if protoAction is "remove"', function (t) {
  const encoder = msgpack({ protoAction: 'remove' })

  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const decoded = encoder.decode(encoder.encode(payload))

  t.equal(decoded.polluted, undefined)
  t.equal(Object.getPrototypeOf(decoded), Object.prototype)
  t.end()
})
