
var test        = require('tape').test
  , msgpack     = require('../')
  , BufferList  = require('bl')

test('must send an object through', function(t) {
  t.plan(1)

  var pack    = msgpack()
    , encoder = pack.encoder()
    , decoder = pack.decoder()
    , data    = { hello: 'world' }

  encoder.pipe(decoder)

  decoder.on('data', function(chunk) {
    t.deepEqual(chunk, data)
  })

  encoder.end(data)
})

test('must send three objects through', function(t) {
  var pack    = msgpack()
    , encoder = pack.encoder()
    , decoder = pack.decoder()
    , data    = [
        { hello: 1 }
      , { hello: 2 }
      , { hello: 3 }
    ]

  t.plan(data.length)

  encoder.pipe(decoder)

  decoder.on('data', function(chunk) {
    t.deepEqual(chunk, data.shift())
  })

  data.forEach(encoder.write.bind(encoder))

  encoder.end()
})

test('must send an object through with an header by default', function(t) {
  t.plan(2)

  var pack    = msgpack()
    , encoder = pack.encoder()
    , data    = { hello: 'world' }
    , encoded = pack.encode(data)

  encoder.once('data', function(header) {
    t.equal(header.readUInt32BE(0), encoded.length)
    encoder.once('data', function(chunk) {
      t.equal(chunk.toString('hex'), encoded.toString('hex'))
    })
  })

  encoder.end(data)
})

test('disable header support in encoder', function(t) {
  t.plan(1)

  var pack    = msgpack()
    , encoder = pack.encoder({ header: false })
    , data    = { hello: 'world' }
    , encoded = pack.encode(data)

  encoder.once('data', function(chunk) {
    t.equal(chunk.toString('hex'), encoded.toString('hex'))
  })

  encoder.end(data)
})

test('end-to-end without headers', function(t) {
  var pack    = msgpack()
    , encoder = pack.encoder({ header: false })
    , decoder = pack.decoder({ header: false })
    , data    = [
        { hello: 1 }
      , { hello: 2 }
      , { hello: 3 }
    ]

  t.plan(data.length)

  encoder.pipe(decoder)

  decoder.on('data', function(chunk) {
    t.deepEqual(chunk, data.shift())
  })

  data.forEach(encoder.write.bind(encoder))

  encoder.end()
})

test('encoding error wrapped', function(t) {
  t.plan(1)

  var pack    = msgpack()
    , encoder = pack.encoder()
    , data    = new MyType()

  function MyType() {
  }

  function mytypeEncode() {
    throw new Error('muahha')
  }

  function mytypeDecode() {
  }

  pack.register(0x42, MyType, mytypeEncode, mytypeDecode)

  encoder.on('error', function(err) {
    t.equal(err.message, 'muahha')
  })

  encoder.end(data)
})

test('decoding error wrapped', function(t) {
  t.plan(1)

  var pack    = msgpack()
    , encoder = pack.encoder()
    , decoder = pack.decoder()
    , data    = new MyType()

  function MyType() {
  }

  function mytypeEncode() {
    return new Buffer(0)
  }

  function mytypeDecode() {
    throw new Error('muahha')
  }

  pack.register(0x42, MyType, mytypeEncode, mytypeDecode)

  decoder.on('error', function(err) {
    t.equal(err.message, 'muahha')
  })

  encoder.end(data)

  encoder.pipe(decoder)
})

test('decoding error wrapped', function(t) {
  t.plan(1)

  var pack    = msgpack()
    , encoder = pack.encoder({ header: false })
    , decoder = pack.decoder({ header: false })
    , data    = new MyType()

  function MyType() {
  }

  function mytypeEncode() {
    return new Buffer(0)
  }

  function mytypeDecode() {
    throw new Error('muahha')
  }

  pack.register(0x42, MyType, mytypeEncode, mytypeDecode)

  decoder.on('error', function(err) {
    t.equal(err.message, 'muahha')
  })

  encoder.end(data)

  encoder.pipe(decoder)
})

test('concatenated buffers work', function(t) {
  var pack    = msgpack()
    , encoder = pack.encoder()
    , decoder = pack.decoder()
    , data    = [
        { hello: 1 }
      , { hello: 2 }
      , { hello: 3 }
    ]

  t.plan(data.length)

  var bl = new BufferList()
  encoder.on('data', bl.append.bind(bl))

  data.forEach(encoder.write.bind(encoder))

  decoder.on('data', function(d) {
    t.deepEqual(d, data.shift())
  })

  encoder.once('finish', function() {
    var buf = bl.slice()
    decoder.write(buf)
  })

  encoder.end()
})
