
var test    = require('tap').test
  , msgpack = require('../')

function build(size) {
  var array = []
    , i

  for(i = 0; i < size; i++) {
    array.push(42)
  }

  return array
}

test('encode/decode arrays up to 15 elements', function(t) {

  var encoder = msgpack()
    , all     = []
    , i

  for(i = 0; i < 16; i++) {
    all.push(build(i))
  }

  all.forEach(function(array) {
    t.test('encoding an array with ' + array.length + ' elements', function(t) {
      var buf = encoder.encode(array)
      // the array is full of 1-byte integers
      t.equal(buf.length, 1 + array.length, 'must have the right length');
      t.equal(buf.readUInt8(0) & 0xf0, 0x90, 'must have the proper header');
      t.equal(buf.readUInt8(0) & 0x0f, array.length, 'must include the array length');
      t.end()
    })

    t.test('mirror test for an array of length ' + array.length, function(t) {
      t.deepEqual(encoder.decode(encoder.encode(array)), array, 'must stay the same');
      t.end()
    })
  })

  t.end()

})
