// Test deferral of next-known type.

var assert = require('assert');
var TestStream = require('./util').TestStream;
var strtok = require('../lib/strtok');

var seen = 0;

strtok.parse(new TestStream('\x1a\x1a\x1a\x1a\x1a\x1a'), function(v, cb) {
    if (v === undefined) {
        return strtok.UINT8_LE;
    }

    switch (seen++ % 2) {
    case 0:
        assert.equal(v, 0x1a);
        process.nextTick(function() {
            cb((seen < 6) ? strtok.UINT8_BE : strtok.DONE);
        });
        return strtok.DEFER;

    case 1:
        assert.equal(v, 0x1a);
        process.nextTick(function() {
            cb((seen < 6) ? strtok.UINT8_LE : strtok.DONE);
        });
        return strtok.DEFER;
    }
});

process.on('exit', function() {
    assert.equal(6, seen);
});
