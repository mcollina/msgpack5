'use strict'

const test = require('node:test')
const msgpack = require('../')

test('throws when encoding sparse arrays', function (t) {
  const encoder = msgpack()

  t.assert.deepStrictEqual(encoder.decode(encoder.encode(new Array(0))), [])
  t.assert.throws(() => encoder.encode(new Array(1)), /Sparse arrays/)
  t.assert.throws(() => encoder.encode(new Array(100)), /Sparse arrays/)

  const sparse = [1, 2, 3, 4]
  delete sparse[3]
  t.assert.throws(() => encoder.encode(sparse), /Sparse arrays/)
})
