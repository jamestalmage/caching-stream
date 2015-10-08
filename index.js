'use strict';
module.exports = cachingStream;
var duplexer = require('duplexify');
var stream = require('readable-stream');

function cachingStream(defensiveCopies) {
	var created = false;
	var cacheStream = noOpReader();

	var output = noOpReader();
	var input = new stream.Writable({write: write})
		.once('finish', inputEnded);

	var duplex = duplexer(input, output);
	duplex.endPassThroughStream = endPassThroughStream;
	duplex.createCacheStream = createCacheStream;
	duplex.dropCache = dropCache;
	return duplex;

	function write(buffer, enc, cb) {
		if (cacheStream) {
			cacheStream.push(copyBuffer(buffer));
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
		if (created) {
			throw new Error('copyStream was already created');
		}
		if (!cacheStream) {
			throw new Error('cache has been dropped');
		}
		created = true;
		return cacheStream;
	}

	function endPassThroughStream() {
		if (output) {
			output.push(null);
			output = null;
		}
	}

	function endCacheStream() {
		if (cacheStream) {
			cacheStream.push(null);
			if (created) {
				cacheStream = null;
			}
		}
	}

	function dropCacheStore() {
		if (!created) {
			cacheStream = null;
		}
	}

	function dropCache(endStream) {
		dropCacheStore();
		if (endStream) {
			endCacheStream();
		}
	}

	function copyBuffer(buffer) {
		return defensiveCopies && output ? new Buffer(buffer) : buffer;
	}
}

function noOp() {}

function noOpReader() {
	return new stream.Readable({read: noOp});
}
