
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
  var buf = null
    , header = null

  try {
    buf = this._msgpack.encode(obj).slice(0)
  } catch(err) {
    this.emit('error', err)
    return done()
  }

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

  this._chunks = bl()
  if (this._header) {
    this._length = -1
    this._transform = decodeWithHeader
  } else {
    this._transform = decodeWithoutHeader
  }
}

inherits(Decoder, Base)

function decodeWithoutHeader(buf, enc, done) {
  if (buf) {
    this._chunks.append(buf)
  }

  try {
    var result = this._msgpack.decode(this._chunks)
    this.push(result)
  } catch(err) {
    if (err instanceof this._msgpack.IncompleteBufferError) {
      done()
    } else {
      this.emit('error', err)
    }
    return
  }

  if (this._chunks.length > 0) {
    this._transform(null, enc, done)
  } else {
    done()
  }
}

function decodeWithHeader(buf, enc, done) {
  // needed for recursive invocation
  if (buf)
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
    try {
      this.push(this._msgpack.decode(this._chunks.slice(0, this._length)))
      this._chunks.consume(this._length)
      this._length = -1
    } catch(err) {
      if (err instanceof this._msgpack.IncompleteBufferError) {
        done()
      } else {
        this.emit('error', err)
      }
      return
    }
  }

  if (this._chunks.length > 0) {
    this._transform(null, enc, done)
  }
  else
    done()
}

module.exports.decoder = Decoder
module.exports.encoder = Encoder
