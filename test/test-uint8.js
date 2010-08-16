// Test reading uint8 values in different endiannesses. Regardless, the
// value should be the same.

var assert = require('assert');
var Stream = require('./stream').Stream;
var strtok = require('../lib/strtok');

var seen = 0;

strtok.parse(new Stream('\x1a\x1a\x1a\x1a\x1a\x1a'), function(v) {
    if (v === undefined) {
        return strtok.Types.UINT8_LE;
    }

    switch (seen++ % 2) {
    case 0:
        assert.equal(v, 0x1a);
        return (seen < 6) ?
            strtok.Types.UINT8_BE :
            strtok.Types.DONE;

    case 1:
        assert.equal(v, 0x1a);
        return (seen < 6) ?
            strtok.Types.UINT8_LE :
            strtok.Types.DONE;
    }
});

process.on('exit', function() {
    assert.equal(6, seen);
});
