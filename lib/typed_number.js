/* TypedNumber
 *
 * A TypedNumber is a wrapper around a JavaScript number that knows
 * which type the number has (double for example) so it can be serialized
 * accordingly.
 */
var TypedNumber = function (value, numberType) {
  this.value = value
  this.numberType = numberType
  this.isTypedNumber = true
};

module.exports.TypedNumber = TypedNumber
