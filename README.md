A streaming tokenizer for [NodeJS](http://nodejs.org).

Parsing data coming off the wire in an event-driven environment can be a
difficult proposition, with naive implementations buffering all received data
in memory until a message has been received in its entirety. Not only is this
infficient from a memory standpoint, but it may not be possible to determine
the that a message has been fully received without attempting to parse it.
This requires a parser that can gracefully handle incomplete messages and
pick up where it left off. To make this task easier, `node-strtok` provides

* Tokenizing primitives for common network datatypes (e.g. signed and
  unsigned integers in variois endian-nesses).
* A callback-driven approach well suited to an asynchronous environment (e.g.
  to allow the application to asynchronously ask another party for
  information about what the next type should be)
* An easily extensible type system for adding support for new,
  application-defined types to the core.

## Usage

Below is an example of a parser for a simple protocol. Each mesasge is
prefixed with a big-endian unsigned 32-bit integer used as a length
specifier, followed by a sequence of opaque bytes with length equal to the
value read earlier.

    var strotk = require('strtok');

    var s = ... /* a net.Stream workalike */;
    
    var numBytes = -1;
    
    strtok.parse(s, function(v, cb) {
        if (v === undefined) {
            return strtok.UINT32_BE;
        }
    
        if (numBytes == -1) {
            numBytes = v;
            return new strtok.BufferType(v);
        }

        console.log('Read ' + v.toString('ascii'));
        numBytes = -1;
    });
