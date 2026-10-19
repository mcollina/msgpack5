'use strict'

const test = require('node:test')
const { promisify } = require('node:util')
const level = require('memdb')
const msgpack = require('../')

test('msgpack level encoding put', async function (t) {
  t.plan(4)

  const pack = msgpack()
  const db = level({
    valueEncoding: pack
  })
  const obj = { my: 'obj' }
  const put = promisify(db.put.bind(db))
  const get = promisify(db.get.bind(db))
  const close = promisify(db.close.bind(db))

  let err
  try {
    await put('hello', obj)
  } catch (e) {
    err = e
  }
  t.assert.ifError(err, 'put has no errors')

  let buf
  try {
    buf = await get('hello', { valueEncoding: 'binary' })
  } catch (e) {
    err = e
  }
  t.assert.ifError(err, 'get has no error')
  t.assert.deepStrictEqual(pack.decode(buf), obj)
  await close()
  t.assert.ok(true, 'db closed')
})

test('msgpack level encoding get', async function (t) {
  t.plan(4)

  const pack = msgpack()
  const db = level({
    valueEncoding: pack
  })
  const obj = { my: 'obj' }
  const buf = pack.encode(obj)
  const put = promisify(db.put.bind(db))
  const get = promisify(db.get.bind(db))
  const close = promisify(db.close.bind(db))

  let err
  try {
    await put('hello', buf, { valueEncoding: 'binary' })
  } catch (e) {
    err = e
  }
  t.assert.ifError(err, 'putting has no errors')

  let result
  try {
    result = await get('hello')
  } catch (e) {
    err = e
  }
  t.assert.ifError(err, 'get has no error')
  t.assert.deepStrictEqual(result, obj)
  await close()
  t.assert.ok(true, 'db closed')
})

test('msgpack level encoding mirror', async function (t) {
  t.plan(4)

  const pack = msgpack()
  const db = level({
    valueEncoding: pack
  })
  const obj = { my: 'obj' }
  const put = promisify(db.put.bind(db))
  const get = promisify(db.get.bind(db))
  const close = promisify(db.close.bind(db))

  let err
  try {
    await put('hello', obj)
  } catch (e) {
    err = e
  }
  t.assert.ifError(err, 'putting has no errors')

  let result
  try {
    result = await get('hello')
  } catch (e) {
    err = e
  }
  t.assert.ifError(err, 'get has no error')
  t.assert.deepStrictEqual(result, obj)
  await close()
  t.assert.ok(true, 'db closed')
})
