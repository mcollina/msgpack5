'use strict'

const Buffer = require('safe-buffer').Buffer
const { once } = require('node:events')
const test = require('node:test')
const msgpack = require('../')
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

test('must send an object through', async function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = { hello: 'world' }

  decoder.on('data', function (chunk) {
    t.assert.deepStrictEqual(chunk, data)
  })

  const done = once(decoder, 'end')
  encoder.pipe(decoder)
  encoder.end(data)
  await done
})

test('must send three objects through', async function (t) {
  t.plan(3)

  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = [
    { hello: 1 },
    { hello: 2 },
    { hello: 3 }
  ]

  decoder.on('data', function (chunk) {
    t.assert.deepStrictEqual(chunk, data.shift())
  })

  const done = once(decoder, 'end')
  data.forEach(encoder.write.bind(encoder))

  encoder.pipe(decoder)

  encoder.end()
  await done
})

test('end-to-end', async function (t) {
  t.plan(3)

  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = [
    { hello: 1 },
    { hello: 2 },
    { hello: 3 }
  ]

  decoder.on('data', function (chunk) {
    t.assert.deepStrictEqual(chunk, data.shift())
  })

  const done = once(decoder, 'end')

  data.forEach(encoder.write.bind(encoder))

  encoder.end()

  encoder.pipe(decoder)
  await done
})

test('encoding error wrapped', async function (t) {
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
    t.assert.strictEqual(err.message, 'muahha')
  })

  const done = once(encoder, 'error')
  encoder.end(data)
  await done
})

test('decoding error wrapped', async function (t) {
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
    t.assert.strictEqual(err.message, 'muahha')
  })

  encoder.end(data)

  encoder.pipe(decoder)
  await once(decoder, 'error')
})

test('decoding error wrapped', async function (t) {
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
    t.assert.strictEqual(err.message, 'muahha')
  })

  encoder.end(data)

  encoder.pipe(decoder)
  await once(decoder, 'error')
})

test('concatenated buffers work', async function (t) {
  t.plan(3)

  const pack = msgpack()
  const encoder = pack.encoder()
  const decoder = pack.decoder()
  const data = [
    { hello: 1 },
    { hello: 2 },
    { hello: 3 }
  ]

  const chunks = new DynamicBuffer()
  encoder.on('data', chunks.append.bind(chunks))

  data.forEach(encoder.write.bind(encoder))

  const done = new Promise((resolve, reject) => {
    decoder.on('data', function (d) {
      t.assert.deepStrictEqual(d, data.shift())
      if (data.length === 0) resolve()
    })
    decoder.on('error', reject)
  })

  encoder.once('finish', function () {
    const buf = chunks.slice()
    decoder.write(buf)
  })

  encoder.end()
  await done
})

test('map32 header split across chunks', async function (t) {
  t.plan(2)

  const decoder = msgpack().decoder()

  const done = new Promise((resolve, reject) => {
    decoder.on('data', function (value) {
      t.assert.deepStrictEqual(value, {}, 'must decode the map')
    })

    decoder.on('error', function (err) {
      reject(err)
    })

    decoder.on('end', function () {
      t.assert.ok(true, 'must end normally')
      resolve()
    })
  })

  const encoded = [0xdf, 0x00, 0x00, 0x00, 0x00]
  encoded.forEach(function (byte) {
    decoder.write(Buffer.from([byte]))
  })
  decoder.end()
  await done
})

test('many concatenated values do not overflow the stack', async function (t) {
  t.plan(2)

  const total = 50000
  const decoder = msgpack().decoder()
  let decoded = 0

  decoder.on('data', function () {
    decoded++
  })

  await new Promise((resolve, reject) => {
    decoder.write(Buffer.alloc(total, 0x01), function (err) {
      try {
        t.assert.ifError(err, 'must decode without an error')
        t.assert.strictEqual(decoded, total, 'must decode every value')
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
})

test('incomplete containers resume without decoding elements again', async function (t) {
  t.plan(3)

  const pack = msgpack()
  const decoder = pack.decoder()
  const values = []
  let decodeCalls = 0
  let maxBuffered = 0

  function MyType (value) {
    this.value = value
  }

  pack.register(0x42, MyType, function (obj) {
    return Buffer.from([obj.value])
  }, function (buf) {
    decodeCalls++
    return buf.readUInt8(0)
  })

  for (let i = 0; i < 100; i++) {
    values.push(new MyType(i))
  }

  const done = new Promise((resolve, reject) => {
    decoder.on('data', function (result) {
      t.assert.deepStrictEqual(result, { values: values.map(function (value) { return value.value }) })
      t.assert.strictEqual(decodeCalls, values.length, 'each completed element is decoded once')
      resolve()
    })
    decoder.on('error', reject)
  })

  const encoded = pack.encode({ values })
  for (let i = 0; i < encoded.length; i++) {
    decoder.write(encoded.slice(i, i + 1))
    maxBuffered = Math.max(maxBuffered, decoder._chunks.length)
  }
  t.assert.ok(maxBuffered <= 6, 'only the current incomplete value remains buffered')
  decoder.end()
  await done
})
test('nil processing works', async function (t) {
  t.plan(3)

  const pack = msgpack()
  const decoder = pack.decoder({ wrap: true })
  let decodedItemIndex = 0

  decoder.on('data', function (chunk) {
    decodedItemIndex++
    t.assert.deepStrictEqual(chunk.value, decodedItemIndex === 1 ? null : false)
  })

  const done = once(decoder, 'end')
  decoder.on('end', function () {
    t.assert.strictEqual(decodedItemIndex, 2)
  })

  decoder.write(Buffer.from([0xc0, 0xc2]))
  decoder.end()
  await done
})

test('encoder wrap mode works', async function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder({ wrap: true })
  const decoder = pack.decoder()
  const data = { hello: 'world' }
  const wrappedData = { value: data }

  encoder.pipe(decoder)

  decoder.on('data', function (chunk) {
    t.assert.deepStrictEqual(chunk, data)
  })

  const done = once(decoder, 'end')
  encoder.end(wrappedData)
  await done
})

test('encoder/decoder wrap mode must send an object through', async function (t) {
  t.plan(1)

  const pack = msgpack()
  const encoder = pack.encoder({ wrap: true })
  const decoder = pack.decoder({ wrap: true })
  const data = { value: { hello: 'world' } }

  encoder.pipe(decoder)

  decoder.on('data', function (chunk) {
    t.assert.deepStrictEqual(chunk, data)
  })

  const done = once(decoder, 'end')
  encoder.end(data)
  await done
})

test('encoder pack null', async function (t) {
  t.plan(2)
  const pack = msgpack()
  const encoder = pack.encoder({ wrap: true })
  const decoder = pack.decoder({ wrap: true })

  encoder.pipe(decoder)

  let decodedItemIndex = 0
  decoder.on('data', function (chunk) {
    decodedItemIndex++
    t.assert.deepStrictEqual(chunk.value, null)
  })

  decoder.on('end', function () {
    t.assert.strictEqual(decodedItemIndex, 1)
  })

  const done = once(decoder, 'end')
  encoder.write({ value: null })
  encoder.end()
  await done
})
