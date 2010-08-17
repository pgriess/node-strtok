// Verify that the DONE value is respected.

var assert = require('assert');
var util = require('./util');
var strtok = require('../lib/strtok');

util.runTest('\x1a\x1a\x1a\x1a\x1a\x1a', [
    function(v) {
        assert.ok(v === undefined);
        return strtok.UINT8;
    },
    function(v) {
        return strtok.DONE;
    }
]);
