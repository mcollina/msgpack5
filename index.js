
var assert      = require('assert')
  , bl          = require('bl')
  , streams     = require('./lib/streams')
  , buildDecode = require('./lib/decoder')
  , buildEncode = require('./lib/encoder')

function msgpack(options) {

  var encodingTypes = []
    , decodingTypes = []

  options = options ? options : { forceFloat64: false }

  function registerEncoder(check, encode) {
    assert(check, 'must have an encode function')
    assert(encode, 'must have an encode function')

    encodingTypes.push({
        check: check
      , encode: encode
    })

    return this
  }

  function registerDecoder(type, decode) {
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')

    decodingTypes.push({
        type: type
      , decode: decode
    })

    return this
  }

  function register(type, constructor, encode, decode) {
    assert(constructor, 'must have a constructor')
    assert(encode, 'must have an encode function')
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')

    function check(obj) {
      return (obj instanceof constructor)
    }

    function reEncode(obj) {
      var buf = bl()
        , header = new Buffer(1)

      header.writeInt8(type, 0)

      buf.append(header)
      buf.append(encode(obj))

      return buf
    }

    this.registerEncoder(check, reEncode)
    this.registerDecoder(type, decode)

    return this
  }

  return {
      encode: buildEncode(encodingTypes, options.forceFloat64)
    , decode: buildDecode(decodingTypes)
    , register: register
    , registerEncoder: registerEncoder
    , registerDecoder: registerDecoder
    , encoder: streams.encoder
    , decoder: streams.decoder

    // needed for levelup support
    , buffer: true
    , type: 'msgpack5'
    , IncompleteBufferError: buildDecode.IncompleteBufferError
  }
}

module.exports = msgpack
