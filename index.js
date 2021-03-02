'use strict'

var Buffer = require('safe-buffer').Buffer
var assert = require('assert')
var bl = require('bl')
var streams = require('./lib/streams')
var buildDecode = require('./lib/decoder')
var buildEncode = require('./lib/encoder')
var IncompleteBufferError = require('./lib/helpers.js').IncompleteBufferError
var DateCodec = require('./lib/codecs/DateCodec')

function msgpack (options) {
  var encodingTypes = []
  var decodingTypes = new Map()

  options = options || {
    forceFloat64: false,
    compatibilityMode: false,
    // if true, skips encoding Dates using the msgpack
    // timestamp ext format (-1)
    disableTimestampEncoding: false,
    preferMap: false
  }

  decodingTypes.set(DateCodec.type, DateCodec.decode)
  if (!options.disableTimestampEncoding) {
    encodingTypes.push(DateCodec)
  }

  function registerEncoder (check, encode) {
    assert(check, 'must have an encode function')
    assert(encode, 'must have an encode function')

    encodingTypes.push({ check, encode })

    return this
  }

  function registerDecoder (type, decode) {
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')
    decodingTypes.set(type, decode)
    return this
  }

  function register (type, constructor, encode, decode) {
    assert(constructor, 'must have a constructor')
    assert(encode, 'must have an encode function')
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')

    function check (obj) {
      return (obj instanceof constructor)
    }

    function reEncode (obj) {
      var buf = bl()
      var header = Buffer.allocUnsafe(1)

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
    encode: buildEncode(encodingTypes, options),
    decode: buildDecode(decodingTypes, options),
    register,
    registerEncoder,
    registerDecoder,
    encoder: streams.encoder,
    decoder: streams.decoder,
    // needed for levelup support
    buffer: true,
    type: 'msgpack5',
    IncompleteBufferError
  }
}

module.exports = msgpack
