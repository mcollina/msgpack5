'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

test('encode/decode map with multiple short buffers as both keys and values', function (t) {
  const first = Buffer.from('first')
  const second = Buffer.from('second')
  const third = Buffer.from('third')

  const mapping = new Map().set(first, second)
    .set(second, third)
    .set(third, first)

  const pack = msgpack()

  const newMapping = pack.decode(pack.encode(mapping))

  t.assert.strictEqual(newMapping.size, mapping.size)
  t.assert.deepStrictEqual([...newMapping.keys()], [...mapping.keys()])
  t.assert.deepStrictEqual([...newMapping.values()], [...mapping.values()])
})
