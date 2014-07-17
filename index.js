
var assert = require('assert')

function msgpack() {

  function encode(obj) {
    if (typeof obj == 'number') {
      if (obj < 0x80) {
        return new Buffer([obj])
      }
    }

    throw new Error('not implemented yet')
  }

  function decode(buf) {
    assert(Buffer.isBuffer(buf), 'must be a Buffer')
    assert(buf.length > 0, 'must not be empty')

    if (buf[0] < 0x80) {
      return buf[0]
    } else {
      throw new Error('not implemented yet')
    }
  }

  return {
    encode: encode,
    decode: decode
  }
}

module.exports = msgpack
