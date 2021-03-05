'use strict'

const test = require('tape').test
const fs = require('fs')
const p = require('path')
const msgpack = require('../')

test('encode/decode map with multiple short buffers', function (t) {
  const map = {
    first: 'first',
    second: 'second',
    third: 'third'
  }
  const pack = msgpack()

  t.deepEqual(pack.decode(pack.encode(map)), map)
  t.end()
})

if (process.title !== 'browser') {
  test('encode/decode map with all files in this directory', function (t) {
    const files = fs.readdirSync(__dirname)
    const map = files.reduce(function (acc, file) {
      acc[file] = fs.readFileSync(p.join(__dirname, file)).toString('utf8')
      return acc
    }, {})
    const pack = msgpack()

    t.deepEqual(pack.decode(pack.encode(map)), map)
    t.end()
  })
}
