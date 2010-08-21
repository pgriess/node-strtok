// Test writing and reading uint8 values.

var assert = require('assert');
var util = require('./util');
var strtok = require('../lib/strtok');

util.runGenerateTests(
    [function(s) {
        strtok.UINT8.put(s, 0x22);
    }, '\x22'],
    [function(s) {
        strtok.UINT8.put(s, 0xff);
    }, '\xff']
);

var f = function(v) {
    assert.equal(v, 0x1a);
    return strtok.UINT8;
};

util.runParseTests('\x1a\x1a\x1a\x1a\x1a\x1a', [
    function(v) {
        assert.strictEqual(v, undefined);
        return strtok.UINT8;
    },
    f, f, f, f, f, f
]);
