// Test deferral of next-known type.

var assert = require('assert');
var Stream = require('./stream').Stream;
var strtok = require('../lib/strtok');

var seen = 0;

strtok.parse(new Stream('\x1a\x1a\x1a\x1a\x1a\x1a'), function(v, cb) {
    if (v === undefined) {
        return strtok.Types.UINT8_LE;
    }

    switch (seen++ % 2) {
    case 0:
        assert.equal(v, 0x1a);
        process.nextTick(function() {
            cb((seen < 6) ? strtok.Types.UINT8_BE : strtok.Types.DONE);
        });
        return strtok.Types.DEFER;

    case 1:
        assert.equal(v, 0x1a);
        process.nextTick(function() {
            cb((seen < 6) ? strtok.Types.UINT8_LE : strtok.Types.DONE);
        });
        return strtok.Types.DEFER;
    }
});

process.on('exit', function() {
    assert.equal(6, seen);
});
