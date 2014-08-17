
var test    = require('tape').test
  , msgpack = require('../')

test('encoding/decoding 32-bits float numbers', function(t) {
  var encoder = msgpack()
    , allNum  = []

  allNum.push(748365544534.2)
  allNum.push(-222111111000004.2)

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
        , dec = buf.readDoubleBE(1)
      t.equal(buf.length, 9, 'must have 5 bytes')
      t.equal(buf[0], 0xcb, 'must have the proper header');
      t.true(Math.abs(dec - num) < 0.1, 'must decode correctly');
      t.end()
    })

    t.test('decoding ' + num, function(t) {
      var buf = new Buffer(9)
        , dec
      buf[0] = 0xcb
      buf.writeDoubleBE(num, 1)
      dec = encoder.decode(buf)
      t.true(Math.abs(dec - num) < 0.1, 'must decode correctly');
      t.end()
    })

    t.test('mirror test ' + num, function(t) {
      var dec = encoder.decode(encoder.encode(num))
      t.true(Math.abs(dec - num) < 0.1, 'must decode correctly');
      t.end()
    })
  })

  t.end()
})
