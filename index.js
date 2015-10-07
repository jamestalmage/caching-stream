'use strict';
module.exports = cachingStream;
var through2 = require('through2');

function cachingStream() {
	var ended = false;
	var caching = true;
	var passingThrough = true;

	var cache = [];
	var copyStream = null;

	var output = through2();

	return {
		input: through2(handleData, handleFlush),
		output: output,
		endOutput: endOutput,
		makeCopyStream: makeCopyStream,
		dropCache: dropCache
	};

	function handleData(buffer, enc, cb) {
		if (caching) {
			var cacheCopy = passingThrough ? new Buffer(buffer) : buffer;
			if (copyStream) {
				copyStream.push(cacheCopy);
			} else {
				cache.push(cacheCopy);
			}
		}
		if (passingThrough) {
			output.push(buffer);
		}
		cb();
	}

	function handleFlush(cb) {
		ended = true;
		if (output) {
			output.end();
		}
		if (caching && copyStream) {
			dropCache(true);
		}
		cb();
	}

	function makeCopyStream() {
		if (copyStream) {
			throw new Error('copyStream was already created');
		}
		if (!caching) {
			throw new Error('cache has been dropped');
		}
		try {
			copyStream = through2();
			cache.forEach(function (buffer) {
				copyStream.push(buffer);
			});
			return copyStream;
		} finally {
			cache = null;
			if (ended) {
				dropCache(true);
			}
		}
	}

	function endOutput() {
		passingThrough = false;
		output.end();
		output = null;
	}

	function dropCache(endStream) {
		cache = null;
		if (copyStream && endStream) {
			copyStream.end();
			copyStream = null;
		}
		if (!copyStream) {
			caching = false;
		}
	}
}
