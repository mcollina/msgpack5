'use strict'

const test = require('node:test')
const msgpack = require('../')
const noop = function () {}

test('encode a function inside a map', function (t) {
  const encoder = msgpack()
  const expected = {
    hello: 'world'
  }
  const toEncode = {
    hello: 'world',
    func: noop
  }

  t.assert.deepStrictEqual(encoder.decode(encoder.encode(toEncode)), expected, 'remove the function from the map')
})
