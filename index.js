'use strict';
module.exports = cachingStream;
var duplexer = require('duplexify');
var stream = require('readable-stream');

function cachingStream() {
	var created = false;
	var copyStream = noOpReader();

	var output = noOpReader();
	var input = new stream.Writable({write: write})
		.once('finish', inputEnded);

	var duplex = duplexer(input, output);
	duplex.endPassThroughStream = endPassThroughStream;
	duplex.createCacheStream = createCacheStream;
	duplex.dropCache = dropCache;
	return duplex;

	function write(buffer, enc, cb) {
		if (copyStream) {
			copyStream.push(
				output ? new Buffer(buffer) : buffer
			);
		}
		if (output) {
			output.push(buffer);
		}
		cb();
	}

	function inputEnded() {
		endPassThroughStream();
		endCacheStream();
	}

	function createCacheStream() {
		if (created && copyStream) {
			throw new Error('copyStream was already created');
		}
		if (!copyStream) {
			throw new Error('cache has been dropped');
		}
		created = true;
		return copyStream;
	}

	function endPassThroughStream() {
		if (output) {
			output.push(null);
			output = null;
		}
	}

	function endCacheStream() {
		if (copyStream) {
			copyStream.push(null);
			if (created) {
				copyStream = null;
			}
		}
	}

	function dropCacheStore() {
		if (!created) {
			copyStream = null;
		}
	}

	function dropCache(endStream) {
		dropCacheStore();
		if (endStream) {
			endCacheStream();
		}
	}
}

function noOp() {}

function noOpReader() {
	return new stream.Readable({read: noOp});
}
