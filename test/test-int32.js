// Test reading int32 values.

var assert = require('assert');
var util = require('./util');
var strtok = require('../lib/strtok');

util.runTest('\x00\x00\x00\x00\xff\xff\xff\xff\x00\x10\x00\xff\x80\x00\x00\x00', [
    function(v) {
        assert.ok(v === undefined);
        return strtok.INT32_BE;
    },
    function(v) {
        assert.equal(v, 0);
        return strtok.INT32_BE;
    },
    function(v) {
        assert.equal(v, -1);
        return strtok.INT32_BE;
    },
    function(v) {
        assert.equal(v, 1048831);
        return strtok.INT32_BE;
    },
    function(v) {
        assert.equal(v, -2147483648);
        return strtok.INT32_BE;
    }
]);
