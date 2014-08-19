
var Transform = require('readable-stream').Transform
  , inherits  = require('inherits')
  , bl        = require('bl')

function Base(opts) {
  opts = opts || {}

  opts.objectMode = true
  opts.highWaterMark = 16

  Transform.call(this, opts)

  this._header = opts.header === undefined || opts.header
  this._msgpack = opts.msgpack
}

inherits(Base, Transform)

function Encoder(opts) {
  if (!(this instanceof Encoder)) {
    opts = opts || {}
    opts.msgpack = this
    return new Encoder(opts)
  }

  Base.call(this, opts)
}

inherits(Encoder, Base)

Encoder.prototype._transform = function(obj, enc, done) {
  var buf = this._msgpack.encode(obj).slice(0)
    , header = null

  if (this._header) {
    header = new Buffer(4)
    header.writeUInt32BE(buf.length, 0)
    this.push(header)
  }

  this.push(buf)
  done()
}

function Decoder(opts) {
  if (!(this instanceof Decoder)) {
    opts = opts || {}
    opts.msgpack = this
    return new Decoder(opts)
  }

  Base.call(this, opts)

  if (this._header) {
    this._chunks = bl()
    this._length = -1
    this._transform = decodeWithHeader
  } else {
    this._transform = decodeWithoutHeader
  }
}

inherits(Decoder, Base)

function decodeWithoutHeader(buf, enc, done) {
  this.push(this._msgpack.decode(buf))
  done()
}

function decodeWithHeader(buf, enc, done) {
  this._chunks.append(buf)

  // we need to parse the header
  if (this._length == -1) {

    // no header yet
    if (this._chunks.length < 4)
      return done()

    this._length = this._chunks.readUInt32BE(0)
    this._chunks.consume(4)
  }

  // parse the packet
  if (this._chunks.length >= this._length) {
    this.push(this._msgpack.decode(this._chunks.slice(0, this._length)))
    this._chunks.consume(this._length)
    this._length = -1
  }

  done()
}

module.exports.decoder = Decoder
module.exports.encoder = Encoder
