
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

test('encode/decode arrays up to 0xffffffff elements', function(t) {

  var encoder = msgpack()

  function doTest(array) {
    t.test('encoding an array with ' + array.length + ' elements', function(t) {
      var buf = encoder.encode(array)
      // the array is full of 1-byte integers
      t.equal(buf.length, 5 + array.length, 'must have the right length');
      t.equal(buf.readUInt8(0), 0xdd, 'must have the proper header');
      t.equal(buf.readUInt32BE(1), array.length, 'must include the array length');
      t.end()
    })

    t.test('mirror test for an array of length ' + array.length, function(t) {
      t.deepEqual(encoder.decode(encoder.encode(array)), array, 'must stay the same');
      t.end()
    })
  }

  doTest(build(0xffff + 1))
  doTest(build(0xffff + 42))
  // unable to test bigger arrays do to out of memory errors

  t.end()
})
