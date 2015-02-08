
var test    = require('tape').test
  , msgpack = require('../')
  , bl      = require('bl')

test('encode/decode variable ext data up to 0xff', function(t) {

  var encoder = msgpack()
    , all     = []

  function MyType(size, value) {
    this.value = value
    this.size  = size
  }

  function mytipeEncode(obj) {
    var buf = new Buffer(obj.size)
    buf.fill(obj.value)
    return buf
  }

  function mytipeDecode(data) {
    var result = new MyType(data.length, data.toString('utf8', 0, 1))
      , i

    for (i = 0; i < data.length; i++) {
      if (data.readUInt8(0) != data.readUInt8(i)) {
        throw new Error('should all be the same')
      }
    }

    return result
  }

  encoder.register(0x42, MyType, mytipeEncode, mytipeDecode)

  // no 1 as it's a fixext
  // no 2 as it's a fixext
  all.push(new MyType(3, 'a'))
  // no 4 as it's a fixext
  all.push(new MyType(5, 'a'))
  all.push(new MyType(6, 'a'))
  all.push(new MyType(7, 'a'))
  // no 8 as it's a fixext
  all.push(new MyType(9, 'a'))
  all.push(new MyType(10, 'a'))
  all.push(new MyType(11, 'a'))
  all.push(new MyType(12, 'a'))
  all.push(new MyType(13, 'a'))
  all.push(new MyType(14, 'a'))
  all.push(new MyType(15, 'a'))
  // no 16 as it's a fixext
  all.push(new MyType(17, 'a'))

  all.push(new MyType(255, 'a'))

  all.forEach(function(orig) {
    t.test('encoding a custom obj of length ' + orig.size, function(t) {
      var buf = encoder.encode(orig)
      t.equal(buf.length, 3 + orig.size, 'must have the right length')
      t.equal(buf.readUInt8(0), 0xc7, 'must have the ext header')
      t.equal(buf.readUInt8(1), orig.size, 'must include the data length')
      t.equal(buf.readUInt8(2), 0x42, 'must include the custom type id')
      t.equal(buf.toString('utf8', 3, 4), orig.value, 'must decode correctly')
      t.end()
    })

    t.test('mirror test with a custom obj of length ' + orig.size, function(t) {
      t.deepEqual(encoder.decode(encoder.encode(orig)), orig, 'must stay the same')
      t.end()
    })
  })

  t.test('decoding an incomplete variable ext data up to 0xff', function(t) {
    var obj = encoder.encode(new MyType(250, 'a'))
    var buf = new Buffer(obj.length)
    buf[0] = 0xc7
    buf.writeUInt8(obj.length + 2, 1) // set bigger size
    obj.copy(buf, 2, 2, obj.length)
    buf = bl().append(buf)
    var origLength = buf.length
    t.throws(function() {encoder.decode(buf)}, encoder.IncompleteBufferError, "must throw IncompleteBufferError")
    t.equals(buf.length, origLength, "must not consume any byte")
    t.end()
  })

  t.test('decoding an incomplete header of variable ext data up to 0xff', function(t) {
    var buf = new Buffer(2)
    buf[0] = 0xc7
    buf = bl().append(buf)
    var origLength = buf.length
    t.throws(function() {encoder.decode(buf)}, encoder.IncompleteBufferError, "must throw IncompleteBufferError")
    t.equals(buf.length, origLength, "must not consume any byte")
    t.end()
  })

  t.end()
})
