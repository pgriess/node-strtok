// Test reading int16 values.

var assert = require('assert');
var util = require('./util');
var strtok = require('../lib/strtok');

util.runParseTests('\x0a\x1a\x00\x00\xff\xff\x80\x00', [
    function(v) {
        assert.ok(v === undefined);
        return strtok.INT16_BE;
    },
    function(v) {
        assert.equal(v, 2586);
        return strtok.INT16_BE;
    },
    function(v) {
        assert.equal(v, 0);
        return strtok.INT16_BE;
    },
    function(v) {
        assert.equal(v, -1);
        return strtok.INT16_BE;
    },
    function(v) {
        assert.equal(v, -32768);
        return strtok.INT16_BE;
    }
]);
