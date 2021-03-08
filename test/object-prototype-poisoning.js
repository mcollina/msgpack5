'use strict'

var test = require('tape').test
var msgpack = require('../')

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

test('decode ignores forbidden __proto__ property if protoAction is "ignore"', function (t) {
  const encoder = msgpack({ protoAction: 'ignore' })

  const payload = { hello: 'world' }
  Object.defineProperty(payload, '__proto__', {
    value: { polluted: true },
    enumerable: true
  })

  const decoded = encoder.decode(encoder.encode(payload))

  t.equal(decoded.polluted, true)
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
  t.end()
})
