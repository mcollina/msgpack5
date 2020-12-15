var test = require('tape').test
var msgpack = require('../')

test('encode date is null ', function (t) {
  var encoder = msgpack({
    disableTimestampEncoding: true
  })

  t.equal(encoder.encode(null)[0], 0xc0, 'encode null as null')

  t.end()
})
