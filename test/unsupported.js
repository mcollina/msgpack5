'use strict'

var test = require('tape').test
var msgpack = require('../')

function isNaN (n) {
  /* eslint-disable no-self-compare */
  return n !== n && typeof n === 'number'
  /* eslint-enable no-self-compare */
}

test('encode/compatibility mode', function (t) {
  var defaultEncoder = msgpack()

  var compatEncoder = msgpack({
    transformUnsupported: function (o) {
      if (o === undefined) {
        return defaultEncoder.encode({ 'undefined': true })
      } else if (isNaN(o)) {
        return defaultEncoder.encode({ 'NaN': true })
      } else {
        return defaultEncoder.encode({ 'unsupported': true })
      }
    }
  })

  t.test('should now handle unsupported types with provided func', function (t) {
    // Default: use 1 byte length string (str8)
    var buf = compatEncoder.encode([ undefined, NaN ])
    const [ A, B ] = compatEncoder.decode(buf)
    t.equal(A.undefined, true)
    t.equal(B.NaN, true)
    t.end()
  })
})
