'use strict'

const test = require('tape').test
const level = require('memdb')
const msgpack = require('../')

test('msgpack level encoding put', function (t) {
  t.plan(4)

  const pack = msgpack()
  const db = level({
    valueEncoding: pack
  })
  const obj = { my: 'obj' }

  db.put('hello', obj, function (err) {
    t.error(err, 'put has no errors')
    db.get('hello', { valueEncoding: 'binary' }, function (err, buf) {
      t.error(err, 'get has no error')
      t.deepEqual(pack.decode(buf), obj)
      db.close(function () {
        t.pass('db closed')
      })
    })
  })
})

test('msgpack level encoding get', function (t) {
  t.plan(4)

  const pack = msgpack()
  const db = level({
    valueEncoding: pack
  })
  const obj = { my: 'obj' }
  const buf = pack.encode(obj)

  db.put('hello', buf, { valueEncoding: 'binary' }, function (err) {
    t.error(err, 'putting has no errors')
    db.get('hello', function (err, result) {
      t.error(err, 'get has no error')
      t.deepEqual(result, obj)
      db.close(function () {
        t.pass('db closed')
      })
    })
  })
})

test('msgpack level encoding mirror', function (t) {
  t.plan(4)

  const pack = msgpack()
  const db = level({
    valueEncoding: pack
  })
  const obj = { my: 'obj' }

  db.put('hello', obj, function (err) {
    t.error(err, 'putting has no errors')
    db.get('hello', function (err, result) {
      t.error(err, 'get has no error')
      t.deepEqual(result, obj)
      db.close(function () {
        t.pass('db closed')
      })
    })
  })
})
