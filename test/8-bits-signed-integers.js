
var test    = require('tape').test
  , msgpack = require('../')
  , bl      = require('bl')

test('encoding/decoding 8-bits big-endian signed integers', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 32; i <= 128; i++) {
    allNum.push(-i)
  }

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 2, 'must have 2 bytes')
      t.equal(buf[0], 0xd0, 'must have the proper header');
      t.equal(buf.readInt8(1), num, 'must decode correctly');
      t.end()
    })

    t.test('decoding ' + num, function(t) {
      var buf = new Buffer(3)
      buf[0] = 0xd0
      buf.writeInt8(num, 1)
      t.equal(encoder.decode(buf), num, 'must decode correctly');
      t.end()
    })

    t.test('mirror test ' + num, function(t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same');
      t.end()
    })
  })

  t.end()
})

test('decoding an incomplete 8-bits big-endian signed integer', function(t) {
  var encoder = msgpack()
  var buf = new Buffer(1)
  buf[0] = 0xd0
  buf = bl().append(buf)
  var origLength = buf.length
  t.throws(function() {encoder.decode(buf)}, encoder.IncompleteBufferError, "must throw IncompleteBufferError")
  t.equals(buf.length, origLength, "must not consume any byte")
  t.end()
})
