
var test    = require('tape').test
  , msgpack = require('../')

test('encode/decode 32 <-> (2^8-1) bytes strings', function(t) {

  var encoder = msgpack()
    , all     = []
    , i

  // build base
  for (i = 'a'; i.length < 32; i += 'a') {
  }

  for (; i.length < Math.pow(2,8); i += 'aaaaa') {
    all.push(i)
  }

  all.forEach(function(str) {
    t.test('encoding a string of length ' + str.length, function(t) {
      var buf = encoder.encode(str)
      t.equal(buf.length, 2 + Buffer.byteLength(str), 'must be the proper length')
      t.equal(buf.readUInt8(0), 0xd9, 'must have the proper header');
      t.equal(buf.readUInt8(1), Buffer.byteLength(str), 'must include the str length');
      t.equal(buf.toString('utf8', 2, Buffer.byteLength(str) + 2), str, 'must decode correctly');
      t.end()
    })

    t.test('decoding a string of length ' + str.length, function(t) {
      var buf = new Buffer(2 + Buffer.byteLength(str))
      buf[0] = 0xd9
      buf[1] = Buffer.byteLength(str)
      buf.write(str, 2)
      t.equal(encoder.decode(buf), str, 'must decode correctly');
      t.end()
    })

    t.test('mirror test a string of length ' + str.length, function(t) {
      t.equal(encoder.decode(encoder.encode(str)), str, 'must stay the same');
      t.end()
    })
  })

  t.end()
})
