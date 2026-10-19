'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

const reservedByteError = '0xc1 is a reserved MessagePack byte'

test('reserved byte is invalid rather than incomplete', function (t) {
  t.plan(3)

  const pack = msgpack()
  let error

  try {
    pack.decode(Buffer.from([0xc1]))
  } catch (err) {
    error = err
  }

  t.assert.ok(error, 'must throw an error')
  t.assert.ok(!(error instanceof pack.IncompleteBufferError), 'must not report incomplete input')
  t.assert.strictEqual(error.message, reservedByteError, 'must identify the reserved byte')
})

test('stream decoder rejects reserved byte without retaining input', async function (t) {
  t.plan(5)

  const decoder = msgpack().decoder()
  let decoded = 0
  let errors = 0

  decoder.on('data', function () {
    decoded++
  })

  decoder.on('error', function (err) {
    errors++
    t.assert.strictEqual(err.message, reservedByteError, 'must emit the decoding error')
  })

  const done = new Promise((resolve) => {
    decoder.on('close', function () {
      t.assert.strictEqual(decoded, 0, 'must not emit decoded values')
      t.assert.strictEqual(errors, 1, 'must emit one error')
      t.assert.strictEqual(decoder._chunks.length, 0, 'must release buffered input')
      t.assert.ok(decoder.destroyed, 'must stop accepting input')
      resolve()
    })
  })

  decoder.write(Buffer.concat([
    Buffer.from([0xc1]),
    Buffer.alloc(200 * 1024, 0x01)
  ]))
  await done
})
