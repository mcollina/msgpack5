
var test    = require('tape').test
  , msgpack = require('../')
  , noop = function() {}

test('encode a function inside a map', function(t) {
  var encoder   = msgpack()
    , expected  = {
          hello: 'world'
      }
    , toEncode  = {
          hello: 'world'
        , func: noop
      }

  t.deepEqual(encoder.decode(encoder.encode(toEncode)), expected, 'remove the function from the map');
  t.end()
})
