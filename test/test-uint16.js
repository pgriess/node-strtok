// Test writing and reading uint16 values in different endiannesses.

var assert = require('assert');
var util = require('./util');
var strtok = require('../lib/strtok');

util.runGenerateTests(
    [function(s) {
        strtok.UINT16_LE.put(s, 0xffaa)
    }, '\xaa\xff'],
    [function(s) {
        strtok.UINT16_BE.put(s, 0xffaa)
    }, '\xff\xaa'],
    [function(s) {
        strtok.UINT16_BE.put(s, 0xffaa)
        strtok.UINT16_LE.put(s, 0xffaa)
    }, '\xff\xaa\xaa\xff']
);

var le = function(v) {
    assert.equal(v, 0x001a);
    return strtok.UINT16_BE;
};

var be = function(v) {
    assert.equal(v, 0x1a00);
    return strtok.UINT16_LE;
};

util.runParseTests('\x1a\x00\x1a\x00\x1a\x00\x1a\x00', [
    function(v) {
        assert.ok(v === undefined);
        return strtok.UINT16_LE;
    },
    le, be, le, be
]);
