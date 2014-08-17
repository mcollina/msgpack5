
var test    = require('tape').test
  , msgpack = require('../')

test('encoding/decoding 5-bits negative ints', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 1; i < 32; i++) {
    allNum.push(-i)
  }

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 1, 'must have 1 byte')
      t.equal(- (~0xe0 & buf[0]), num, 'must decode correctly');
      t.end()
    })

    t.test('decoding' + num, function(t) {
      var buf = new Buffer([0xe0 | -num])
      t.equal(encoder.decode(buf), num, 'must decode correctly');
      t.end()
    })

    t.test('mirror test' + num, function(t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same');
      t.end()
    })
  })

  t.end()
})
