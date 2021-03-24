'use strict'

const test = require('tape').test
const msgpack = require('../')

test('encode/decode nested containers (map/array)', function (t) {
  const encoder = msgpack()

  function doEncodeDecode (value) {
    return encoder.decode(encoder.encode(value))
  }

  function preserveTest (A, message = 'works') {
    const B = doEncodeDecode(A)
    t.deepEqual(A, B, message)
  }

  preserveTest({
    hello: 'world',
    digit: 111,
    array: [1, 2, 3, 4, 'string', { hello: 'world' }]
  })

  preserveTest([
    [
      {
        hello: 'world',
        array: [1, 2, 3, 4, 'string', { hello: 'world' }]
      },
      {
        digit: 111
      }
    ],
    [
      {
        hello: 'world',
        digit: 111,
        array: [1, 2, 3, 4, 'string', { hello: 'world' }]
      }
    ]
  ])

  t.end()
})
