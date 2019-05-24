const type = -1

function encode (dt) {
  var millis = dt * 1
  var seconds = Math.floor(millis / 1000)
  var nanos = (millis - seconds * 1000) * 1e6

  if (nanos || seconds > 0xffffffff) {
    // Timestamp64
    const encoded = Buffer.allocUnsafe(9)
    encoded[0] = -1

    var upperNanos = nanos * 4
    var upperSeconds = seconds / Math.pow(2, 32)
    var upper = (upperNanos + upperSeconds) & 0xffffffff
    var lower = seconds & 0xffffffff

    encoded.writeInt32BE(upper, 1)
    encoded.writeInt32BE(lower, 5)
    return encoded
  } else {
    // Timestamp32
    const encoded = Buffer.allocUnsafe(5)
    encoded[0] = -1
    encoded.writeUInt32BE(Math.floor(millis / 1000), 1)
    return encoded
  }
}

function check (obj) {
  return typeof obj.getDate === 'function'
}

function decode (buf) {
  var seconds
  var nanoseconds = 0

  switch (buf.length) {
    case 4:
      // timestamp 32 stores the number of seconds that have elapsed since 1970-01-01 00:00:00 UTC in an 32-bit unsigned integer
      seconds = buf.readUInt32BE(0)
      break

    case 8:
      // Timestamp 64 stores the number of seconds and nanoseconds that have elapsed
      // since 1970-01-01 00:00:00 UTC in 32-bit unsigned integers, split 30/34 bits
      var upper = buf.readUInt32BE(0)
      var lower = buf.readUInt32BE(4)
      nanoseconds = upper / 4
      seconds = ((upper & 0x03) * Math.pow(2, 32)) + lower // If we use bitwise operators, we get truncated to 32bits
      break

    case 12:
      throw new Error('timestamp 96 is not yet implemented')
  }

  var millis = (seconds * 1000) + Math.round(nanoseconds / 1E6)

  return new Date(millis)
}

module.exports = { check, type, encode, decode }
