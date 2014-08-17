
var test    = require('tape').test
  , msgpack = require('../')

test('encode/decode variable ext data up between 0x0100 and 0xffff', function(t) {

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

  all.push(new MyType(0x0100, 'a'))
  all.push(new MyType(0x0101, 'a'))
  all.push(new MyType(0xffff, 'a'))

  all.forEach(function(orig) {
    t.test('encoding a custom obj of length ' + orig.size, function(t) {
      var buf = encoder.encode(orig)
      t.equal(buf.length, 4 + orig.size, 'must have the right length')
      t.equal(buf.readUInt8(0), 0xc8, 'must have the ext header')
      t.equal(buf.readUInt16BE(1), orig.size, 'must include the data length')
      t.equal(buf.readUInt8(3), 0x42, 'must include the custom type id')
      t.equal(buf.toString('utf8', 4, 5), orig.value, 'must decode correctly')
      t.end()
    })

    t.test('mirror test with a custom obj of length ' + orig.size, function(t) {
      t.deepEqual(encoder.decode(encoder.encode(orig)), orig, 'must stay the same')
      t.end()
    })
  })

  t.end()
})
