
var assert = require('assert')

function msgpack() {

  function encode(obj) {
    var buf

    if (obj === null) {
      buf = new Buffer(1)
      buf[0] = 0xc0
    }

    if (obj === true) {
      buf = new Buffer(1)
      buf[0] = 0xc3
    }

    if (obj === false) {
      buf = new Buffer(1)
      buf[0] = 0xc2
    }

    if (typeof obj == 'number') {
      if (obj < 0x80) {
        buf = new Buffer(1)
        buf[0] = obj
      }
    }

    return buf
  }

  function decode(buf) {
    assert(Buffer.isBuffer(buf), 'must be a Buffer')
    assert(buf.length > 0, 'must not be empty')

    if (buf[0] === 0xc0) {
      return null
    } else if(buf[0] === 0xc2) {
      return false
    } else if(buf[0] === 0xc3) {
      return true
    } else if (buf[0] < 0x80) {
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
