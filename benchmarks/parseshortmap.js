
var msgpack = require('../')()
  , bl      = require('bl')
  , msg     = bl(msgpack.encode({ hello: 'world' }))
  , decode  = msgpack.decode
  , max     = 1000000
  , start
  , stop
  , i

function run() {
  for (i = 0; i < max; i++) {
    decode(msg.duplicate())
  }
}

//preheat
run()

start  = Date.now()
run()
stop = Date.now()
console.log('time', stop - start)
console.log('decode/s', max / (stop - start) * 1000)
