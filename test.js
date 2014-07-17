
var test    = require('tap').test
  , msgpack = require('./')

test('encoding/decoding 7-bit ints', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 0; i < 126; i++) {
    allNum.push(i)
  }

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 1, 'must have 1 byte')
      t.equal(buf[0], num, 'must decode correctly');
      t.end()
    })

    t.test('decoding' + num, function(t) {
      var buf = new Buffer([num])
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

test('encode/decode null', function(t) {
  var encoder = msgpack()
  t.equal(encoder.encode(null)[0], 0xc0, 'encode null as 0xc0');
  t.equal(encoder.encode(null).length, 1, 'encode a buffer of length 1');
  t.equal(encoder.decode(new Buffer([0xc0])), null , 'decode 0xc0 as null');
  t.end()
})
