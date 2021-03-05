'use strict'
const test = require('tape').test
const msgpack = require('../')

test('encode date is null ', function (t) {
  const encoder = msgpack({
    disableTimestampEncoding: true
  })

  t.equal(encoder.encode(null)[0], 0xc0, 'encode null as null')

  t.end()
})
