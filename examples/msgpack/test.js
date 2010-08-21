var assert = require('assert');
var Buffer = require('buffer').Buffer;
var msgpack = require('./msgpack');
var strtok = require('../../lib/strtok');
var util = require('../../test/util');

var TESTS = [
    ['\xc0', undefined],                        // nil
    ['\xc3', true],                             // true
    ['\xc2', false],                            // false
    ['\x25', 37 ],                              // positive fixnum
    ['\x6f', 111],                              // positive fixnum
    ['\xff', -32],                              // negative fixnum
    ['\xeb', -12],                              // negative _fixnum
    ['\xcc\xff', 255],                          // uint8
    ['\xcd\x01\x01', 257],                      // uint16
    ['\xce\x01\x01\x01\x01', 16843009],         // uint32
    ['\xd0\xff', -1],                           // int8
    ['\xd0\x80', -128],                         // int8
    ['\xd0\x70', 112],                          // int8
    ['\xd1\xff\xff', -1],                       // int16
    ['\xd1\x80\x00', -32768],                   // int16
    ['\xd1\x01\x00', 256],                      // int16
    ['\xd2\x00\x00\x00\x00', 0],                // int32
    ['\xd2\x00\x00\xff\xff', 65535],            // int32
    ['\xd2\x80\x00\x00\x00', -2147483648],      // int32
    ['\xd2\x80\xff\xff\xff', -2130706433],      // int32
    ['\x93\x78\x0a\xcc\xef', [120, 10, 239]],   // fixarray
    ['\xdc\x00\x01\x25', [37]],                 // array16
    [                                           // array16
        '\xdc\x00\x03\xff\x25\xcc\xff',
        [-32, 37, 255]
    ],
    ['\xdd\x00\x00\x00\x01\x25', [37]],         // array32
    [                                           // array32
        '\xdd\x00\x00\x00\x03\xff\x25\xcc\xff',
        [-32, 37, 255]
    ],
    [                                           // fixraw
        '\xa3\x01\x02\x03',
        '\x01\x02\x03'
    ],
    [                                           // raw16
        '\xda\x00\x03\x01\x02\x03',
        '\x01\x02\x03'
    ],
    [                                           // raw32
        '\xdb\x00\x00\x00\x03\x01\x02\x03',
        '\x01\x02\x03',
    ],
    ['\x81\x25\x6f', {37 : 111}],               // fixmap
    ['\xde\x00\x01\x25\x6f', {37 : 111}],       // map16
    ['\xdf\x00\x00\x00\x01\x25\x6f', {37 : 111}] // map32
];

var f = function() {
    if (TESTS.length === 0) {
        return;
    }

    var t = TESTS.shift();

    strtok.parse(
        new util.TestStream(t[0]),
        msgpack.parser(function(v) {
            assert.deepEqual(v, t[1]);

            f();
        })
    );
};

f();

process.on('exit', function() {
    assert.equal(TESTS.length, 0);
});
