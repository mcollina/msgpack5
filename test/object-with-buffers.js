
var test    = require('tape').test
  , fs      = require('fs')
  , msgpack = require('../')

test('encode/decode map with multiple short buffers', function(t) {
  var map = {
          first: new Buffer('first')
        , second: new Buffer('second')
        , third: new Buffer('third')
      }
    , pack = msgpack()

  t.deepEqual(pack.decode(pack.encode(map)), map)
  t.end()
})

if (process.title !== "browser") {
  test('encode/decode map with all files in this directory', function(t) {

    var files = fs.readdirSync(__dirname)
      , map = files.reduce(function(acc, file) {
          acc[file] = fs.readFileSync(__dirname + '/' + file)
          return acc
        }, {})
      , pack = msgpack()

    t.deepEqual(pack.decode(pack.encode(map)), map)
    t.end()
  })
}
