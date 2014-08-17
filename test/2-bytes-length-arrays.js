
var test    = require('tape').test
  , msgpack = require('../')

function build(size) {
  var array = []
    , i

  for(i = 0; i < size; i++) {
    array.push(42)
  }

  return array
}

test('encode/decode arrays up to 0xffff elements', function(t) {

  var encoder = msgpack()
    , all     = []
    , i

  for(i = 16; i < 0xffff; i += 4242) {
    all.push(build(i))
  }

  all.push(build(0xff))
  all.push(build(0xffff))

  all.forEach(function(array) {
    t.test('encoding an array with ' + array.length + ' elements', function(t) {
      var buf = encoder.encode(array)
      // the array is full of 1-byte integers
      t.equal(buf.length, 3 + array.length, 'must have the right length');
      t.equal(buf.readUInt8(0), 0xdc, 'must have the proper header');
      t.equal(buf.readUInt16BE(1), array.length, 'must include the array length');
      t.end()
    })

    t.test('mirror test for an array of length ' + array.length, function(t) {
      t.deepEqual(encoder.decode(encoder.encode(array)), array, 'must stay the same');
      t.end()
    })
  })

  t.end()

})
