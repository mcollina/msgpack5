var test    = require('tape').test
  , msgpack = require('../')

test('Warn if the type of number is unknown', function (t) {
  var encoder = msgpack()
    , TypedNumber = encoder.TypedNumber
    , typedDouble = new TypedNumber(12.0, 'fouble')

  t.throws(function () {
    encoder.encode(typedDouble)
  }, /unknown type of typednumber/i, "Should raise an error if the type of number is not known")

  t.end()
})

test('Encoding a double', function(t) {
  var encoder = msgpack()
    , TypedNumber = encoder.TypedNumber
    , typedDouble = new TypedNumber(12.0, 'double')
    , buf = encoder.encode(typedDouble)

  t.equal(buf.length, 9, 'must have 5 bytes')
  t.equal(buf[0], 0xcb, 'must have the proper header');

  t.end()
})

test('Decoding a double as typed', function(t) {
  var encoder = msgpack({ typedNumbers: true })
    , TypedNumber = encoder.TypedNumber
    , typedDouble = new TypedNumber(12.0, 'double')
    , buf = encoder.encode(typedDouble)
    , decoded = encoder.decode(buf)

  t.ok(decoded.isTypedNumber, 'must be a typed number')
  t.equal(decoded.value, 12.0, 'must have the same value')
  t.equal(decoded.numberType, 'double', 'must be a double')

  t.end()
});
