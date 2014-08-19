
var test        = require('tape').test
  , msgpack     = require('../')

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
