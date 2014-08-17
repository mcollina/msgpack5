
var test    = require('tape').test
  , msgpack = require('../')

test('encoding/decoding 16-bits big-endian signed integers', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 129; i < 32768; i += 1423) {
    allNum.push(-i)
  }

  allNum.push(-32768)

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 3, 'must have 3 bytes')
      t.equal(buf[0], 0xd1, 'must have the proper header');
      t.equal(buf.readInt16BE(1), num, 'must decode correctly');
      t.end()
    })

    t.test('decoding ' + num, function(t) {
      var buf = new Buffer(3)
      buf[0] = 0xd1
      buf.writeInt16BE(num, 1)
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
