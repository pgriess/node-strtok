// Test reading uint8 values in different endiannesses.

var assert = require('assert');
var util = require('./util');
var strtok = require('../lib/strtok');

var f = function(v) {
    assert.equal(v, 0x1a);
    return strtok.UINT8;
};

util.runTest('\x1a\x1a\x1a\x1a\x1a\x1a', [
    function(v) {
        assert.ok(v === undefined);
        return strtok.UINT8;
    },
    f, f, f, f, f, f
]);
