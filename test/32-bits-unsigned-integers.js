
var test    = require('tape').test
  , msgpack = require('../')

test('encoding/decoding 32-bits big-endian unsigned integers', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 65536; i < 0xffffffff; i += 102350237) {
    allNum.push(i)
  }

  allNum.push(0xfffffffe)

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 5, 'must have 5 bytes')
      t.equal(buf[0], 0xce, 'must have the proper header');
      t.equal(buf.readUInt32BE(1), num, 'must decode correctly');
      t.end()
    })

    t.test('decoding ' + num, function(t) {
      var buf = new Buffer(5)
      buf[0] = 0xce
      buf.writeUInt32BE(num, 1)
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
