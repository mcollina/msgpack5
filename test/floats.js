
var test    = require('tape').test
  , msgpack = require('../')
  , bl      = require('bl')

test('encoding/decoding 32-bits float numbers', function(t) {
  var encoder = msgpack()
    , allNum  = []

  allNum.push(-222.42)
  allNum.push(748364.2)
  allNum.push(2.2)

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
        , dec = buf.readFloatBE(1)
      t.equal(buf.length, 5, 'must have 5 bytes')
      t.equal(buf[0], 0xca, 'must have the proper header');
      t.true(Math.abs(dec - num) < 0.1, 'must decode correctly');
      t.end()
    })

    t.test('decoding ' + num, function(t) {
      var buf = new Buffer(5)
        , dec
      buf[0] = 0xca
      buf.writeFloatBE(num, 1)
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

test('decoding an incomplete 32-bits float numbers', function(t) {
  var encoder = msgpack()
  var buf = new Buffer(4)
  buf[0] = 0xca
  buf = bl().append(buf)
  var origLength = buf.length
  t.throws(function() {encoder.decode(buf)}, encoder.IncompleteBufferError, "must throw IncompleteBufferError")
  t.equals(buf.length, origLength, "must not consume any byte")
  t.end()
})
