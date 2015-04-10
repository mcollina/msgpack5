
var msgpack = require('../')()
  , msg     = { hello: 'world' }
  , encode  = msgpack.encode
  , decode  = msgpack.decode
  , max     = 100000
  , start
  , stop
  , i

function run() {
  for (i = 0; i < max; i++) {
    decode(encode(msg))
  }
}

//preheat
run()

start  = Date.now()
run()
stop = Date.now()
console.log('time', stop - start)
console.log('decode/s', max / (stop - start) * 1000)
