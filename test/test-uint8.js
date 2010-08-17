// Test reading uint8 values in different endiannesses. Regardless, the
// value should be the same.

var assert = require('assert');
var util = require('./util');
var strtok = require('../lib/strtok');

var le  = function(v) {
    assert.equal(v, 0x1a);
    return strtok.UINT8_BE;
};

var be = function(v) {
    assert.equal(v, 0x1a);
    return strtok.UINT8_LE;
};

util.runTest('\x1a\x1a\x1a\x1a\x1a\x1a', [
    function(v) {
        assert.ok(v === undefined);
        return strtok.UINT8_LE;
    },
    le, be, le, be, le, be
]);
