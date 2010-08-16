// Test reading uint32 values in different endiannesses.

var assert = require('assert');
var TestStream = require('./util').TestStream;
var strtok = require('../lib/strtok');

var seen = 0;

strtok.parse(new TestStream('\x1a\x00\x1a\x00\x1a\x00\x1a\x00\x1a\x00\x1a\x00\x1a\x00\x1a\x00'), function(v) {
    if (v === undefined) {
        return strtok.UINT32_LE;
    }

    switch (seen++ % 2) {
    case 0:
        assert.equal(v, 0x001a001a);
        return (seen < 4) ?
            strtok.UINT32_BE :
            strtok.DONE;

    case 1:
        assert.equal(v, 0x1a001a00);
        return (seen < 4) ?
            strtok.UINT32_LE :
            strtok.DONE;
    }
});

process.on('exit', function() {
    assert.equal(4, seen);
});
