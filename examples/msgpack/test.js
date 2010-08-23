var assert = require('assert');
var Buffer = require('buffer').Buffer;
var msgpack = require('./msgpack');
var msgpackNative = require('msgpack');
var strtok = require('../../lib/strtok');
var util = require('../../test/util');

var dumpBuffer = function(b) {
    var hexChars = '0123456789abcdef';

    var l = '';
    for (var i = 0; i < b.length; i++) {
        l += hexChars[(b[i] >> 4) & 0x0f] + hexChars[b[i] & 0x0f]

        if (i % 16 == 15) {
            console.error(l);
            l = '';
        } else if (i % 4 == 3) {
            l += ' ';
        }
    }

    if (l) {
        console.error(l);
    }
};

var TESTS = [
    null,
    true,
    false,
    0,
    17,
    127,
    -1,
    -17,
    -128,
    128,
    255,
    256,
    0xf0ba,
    0xffff,
    0xc0ffee,
    0xfffffffe,
    -512,
    -32000,
    -64000,
    -2147483648,
    'abc',
    'biffo',
    new Buffer('\x01\x02\x03', 'binary'),
    new Buffer('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\xff', 'binary'),
    [],
    [1, 2, 3, 4],
    [1, 2, 3, [11, 12, 13], ['a', 'b', 'c']],
    {},
    {'abcdef' : 1, 'qqq' : 13, '19' : [1, 2, 3, 4]}
];

TESTS.forEach(function(o) {
    var b = new Buffer(1024);

    var len = msgpack.packBuf(b, 0, o);
    b = b.slice(0, len);

    // Do not attempt to verify maps; the orer of (k,v) pairs is arbitrary
    if (typeof o !== 'object' || Array.isArray(o) || (o instanceof Buffer)) {
        try {
            assert.deepEqual(
                b.toString('binary'),
                msgpackNative.pack(o).toString('binary')
            );
        } catch(e) {
            console.error('Failed with value: ' + JSON.stringify(o));
            dumpBuffer(msgpackNative.pack(o));
            dumpBuffer(s.getBuffer());
            throw e;
        }
    }

    var oo = strtok.parse(
        new util.SourceStream(b.toString('binary')),
        msgpack.strtokParser(function(oo) {
            try {
                if (o instanceof Buffer) {
                    assert.deepEqual(oo, o.toString('binary'));
                } else {
                    assert.deepEqual(oo, o);
                }
            } catch (e) {
                console.error('Failed with value: ' + JSON.stringify(o));
                dumpBuffer(s.getBuffer());
                throw e;
            }
        })
    );
});
