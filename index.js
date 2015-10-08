'use strict';
module.exports = cachingStream;
var duplexer = require('duplexify');
var stream = require('readable-stream');

function cachingStream() {
	var ended = false;
	var hasCache = true;

	var cache = [];
	var copyStream = null;

	var output = noOpReader();
	var input = new stream.Writable({write: write})
		.once('finish', inputEnded);

	var duplex = duplexer(input, output);
	duplex.endPassThroughStream = endPassThroughStream;
	duplex.createCacheStream = createCacheStream;
	duplex.dropCache = dropCache;
	return duplex;

	function write(buffer, enc, cb) {
		if (hasCache) {
			var cacheCopy = output ? new Buffer(buffer) : buffer;
			if (copyStream) {
				copyStream.push(cacheCopy);
			} else {
				cache.push(cacheCopy);
			}
		}
		if (output) {
			output.push(buffer);
		}
		cb();
	}

	function inputEnded() {
		ended = true;
		endPassThroughStream();
		endCacheStream();
	}

	function createCacheStream() {
		if (copyStream) {
			throw new Error('copyStream was already created');
		}
		if (!hasCache) {
			throw new Error('cache has been dropped');
		}
		try {
			copyStream = noOpReader();
			cache.forEach(function (buffer) {
				copyStream.push(buffer);
			});
			return copyStream;
		} finally {
			cache = null;
			if (ended) {
				endCacheStream();
			}
		}
	}

	function endPassThroughStream() {
		if (output) {
			output.push(null);
			output = null;
		}
	}

	function endCacheStream() {
		if (copyStream) {
			hasCache = false;
			copyStream.push(null);
			copyStream = null;
		}
	}

	function dropCacheStore() {
		cache = null;
		if (!copyStream) {
			hasCache = false;
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
