'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
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

  t.equals(newMapping.size, mapping.size)
  t.deepEqual([...newMapping.keys()], [...mapping.keys()])
  t.deepEqual([...newMapping.values()], [...mapping.values()])

  t.end()
})
