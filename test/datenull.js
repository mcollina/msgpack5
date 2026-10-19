'use strict'
const test = require('node:test')
const msgpack = require('../')

test('encode date is null ', function (t) {
  const encoder = msgpack({
    disableTimestampEncoding: true
  })

  t.assert.strictEqual(encoder.encode(null)[0], 0xc0, 'encode null as null')
})
