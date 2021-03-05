'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')
const BufferList = require('bl')

test('must send an object through', function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = { hello: 'world' }

  encoder.pipe(decoder)

  decoder.on('data', function (chunk) {
    t.deepEqual(chunk, data)
  })

  encoder.end(data)
})

test('must send three objects through', function (t) {
  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = [
    { hello: 1 },
    { hello: 2 },
    { hello: 3 }
  ]

  t.plan(data.length)

  decoder.on('data', function (chunk) {
    t.deepEqual(chunk, data.shift())
  })

  data.forEach(encoder.write.bind(encoder))

  encoder.pipe(decoder)

  encoder.end()
})

test('end-to-end', function (t) {
  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = [
    { hello: 1 },
    { hello: 2 },
    { hello: 3 }
  ]

  t.plan(data.length)

  decoder.on('data', function (chunk) {
    t.deepEqual(chunk, data.shift())
  })

  data.forEach(encoder.write.bind(encoder))

  encoder.end()

  encoder.pipe(decoder)
})

test('encoding error wrapped', function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder()
  const data = new MyType()

  function MyType () {
  }

  function mytypeEncode () {
    throw new Error('muahha')
  }

  function mytypeDecode () {
  }

  pack.register(0x42, MyType, mytypeEncode, mytypeDecode)

  encoder.on('error', function (err) {
    t.equal(err.message, 'muahha')
  })

  encoder.end(data)
})

test('decoding error wrapped', function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = new MyType()

  function MyType () {
  }

  function mytypeEncode () {
    return Buffer.allocUnsafe(0)
  }

  function mytypeDecode () {
    throw new Error('muahha')
  }

  pack.register(0x42, MyType, mytypeEncode, mytypeDecode)

  decoder.on('error', function (err) {
    t.equal(err.message, 'muahha')
  })

  encoder.end(data)

  encoder.pipe(decoder)
})

test('decoding error wrapped', function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder({ header: false })
  const decoder = pack.decoder({ header: false })
  const data = new MyType()

  function MyType () {
  }

  function mytypeEncode () {
    return Buffer.allocUnsafe(0)
  }

  function mytypeDecode () {
    throw new Error('muahha')
  }

  pack.register(0x42, MyType, mytypeEncode, mytypeDecode)

  decoder.on('error', function (err) {
    t.equal(err.message, 'muahha')
  })

  encoder.end(data)

  encoder.pipe(decoder)
})

test('concatenated buffers work', function (t) {
  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = [
    { hello: 1 },
    { hello: 2 },
    { hello: 3 }
  ]

  t.plan(data.length)

  const bl = new BufferList()
  encoder.on('data', bl.append.bind(bl))

  data.forEach(encoder.write.bind(encoder))

  decoder.on('data', function (d) {
    t.deepEqual(d, data.shift())
  })

  encoder.once('finish', function () {
    const buf = bl.slice()
    decoder.write(buf)
  })

  encoder.end()
})

test('nil processing works', function (t) {
  t.plan(3)

  const pack = msgpack()
  const decoder = pack.decoder({ wrap: true })
  let decodedItemIndex = 0

  decoder.on('data', function (chunk) {
    decodedItemIndex++
    t.deepEqual(chunk.value, decodedItemIndex === 1 ? null : false)
  })

  decoder.on('end', function () {
    t.equal(decodedItemIndex, 2)
  })

  decoder.write(Buffer.from([0xc0, 0xc2]))
  decoder.end()
})

test('encoder wrap mode works', function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder({ wrap: true })
  const decoder = pack.decoder()
  const data = { hello: 'world' }
  const wrappedData = { value: data }

  encoder.pipe(decoder)

  decoder.on('data', function (chunk) {
    t.deepEqual(chunk, data)
  })

  encoder.end(wrappedData)
})

test('encoder/decoder wrap mode must send an object through', function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder({ wrap: true })
  const decoder = pack.decoder({ wrap: true })
  const data = { value: { hello: 'world' } }

  encoder.pipe(decoder)

  decoder.on('data', function (chunk) {
    t.deepEqual(chunk, data)
  })

  encoder.end(data)
})

test('encoder pack null', function (t) {
  t.plan(2)
  const pack = msgpack()
  const encoder = pack.encoder({ wrap: true })
  const decoder = pack.decoder({ wrap: true })

  encoder.pipe(decoder)

  let decodedItemIndex = 0
  decoder.on('data', function (chunk) {
    decodedItemIndex++
    t.deepEqual(chunk.value, null)
  })

  decoder.on('end', function () {
    t.equal(decodedItemIndex, 1)
  })

  encoder.write({ value: null })
  encoder.end()
})
