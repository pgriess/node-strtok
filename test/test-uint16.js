// Test reading uint16 values in different endiannesses.

var assert = require('assert');
var TestStream = require('./util').TestStream;
var strtok = require('../lib/strtok');

var seen = 0;
var data = '\x1a\x00\x1a\x00\x1a\x00\x1a\x00';

strtok.parse(new TestStream(data), function(v) {
    if (v === undefined) {
        return strtok.UINT16_LE;
    }

    switch (seen++ % 2) {
    case 0:
        assert.equal(v, 0x001a);
        return strtok.UINT16_BE;

    case 1:
        assert.equal(v, 0x1a00);
        return strtok.UINT16_LE;
    }
});

process.on('exit', function() {
    assert.equal(data.length / 2, seen);
});
