const test = require('tape').test
const msgpack = require('../')

const map = new Map()
  .set('a', 1)
  .set('1', 'hello')
  .set('world', 2)
  .set('0', 'again')
  .set('01', null)

test('round-trip string-keyed Maps', function (t) {
  const encoder = msgpack({ preferMap: true })

  for (const input of [new Map(), map]) {
    const result = encoder.decode(encoder.encode(input))
    t.assert(result instanceof Map)
    t.deepEqual(result, input)
  }

  t.end()
})

test('preserve iteration order of string-keyed Maps', function (t) {
  const encoder = msgpack({ preferMap: true })
  const decoded = encoder.decode(encoder.encode(map))

  t.deepEqual([...decoded.keys()], [...map.keys()])

  t.end()
})

test('user can still encode objects as ext maps', function (t) {
  const encoder = msgpack({ preferMap: true })
  const tag = 0x42

  // Polyfill Object.fromEntries for node 10
  const fromEntries = Object.fromEntries || (iterable => {
    const object = {}
    for (const [property, value] of iterable) {
      object[property] = value
    }
    return object
  })

  encoder.register(
    tag,
    Object,
    obj => encoder.encode(new Map(Object.entries(obj))),
    data => fromEntries(encoder.decode(data))
  )

  const inputs = [
    {},
    new Map(),
    { foo: 'bar' },
    new Map().set('foo', 'bar'),
    new Map().set(null, null),
    { 0: 'baz' },
    ['baz']
  ]

  for (const input of inputs) {
    const buf = encoder.encode(input)
    const result = encoder.decode(buf)

    t.deepEqual(result, input)
    t.equal(Object.getPrototypeOf(result), Object.getPrototypeOf(input))
  }

  t.end()
})
