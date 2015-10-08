# caching-stream [![Build Status](https://travis-ci.org/jamestalmage/caching-stream.svg?branch=master)](https://travis-ci.org/jamestalmage/caching-stream)

> Keep a copy of streaming data in case the first place you pipe to does not work out.

Provides a pass-through stream that caches a copy of the data in memory to be re-streamed at a later time.
Includes methods to drop the cached data and reclaim the memory once you know you will not need a second copy.

Useful for retries and redirects.

## Install

```
$ npm install --save caching-stream
```

## Usage

```js
var cachingStream = require('caching-stream');

var caching = cachingStream();

caching.pipe(process.stdout);

caching.write('Hello ');
// => "Hello " gets logged to stdout.
 
caching.write('World!');
// => "World" gets logged to stdout.

caching.createCacheStream().pipe(process.stderr);
// => "Hello World!" is piped to stderr.
// cache is immediately emptied to the stream upon creation.

caching.write('Have a nice day!');
// => "Have a nice day!" is piped to both stdout and stderr 

caching.endPassThrough();
// emits "end" event on passThrough chain
// no more data will be written to stdout

caching.write(...); // remaining writes only go to stderr 

caching.dropCache();
// discard cached data
// no effect in this case because `createCacheStream()` has already been called.

caching.dropCache(true); 
// discards any cached data and emits "end" on the cache stream.
// no more data will be piped to the cached stream. 
```

## API

### cached = cachingStream(defensiveCopies)

Creates a caching stream. It is a `DuplexStream` stream, that has all the events/methods from 
both the `Readable` and `Writable` stream classes. It passes data through unaltered.

If `defensiveCopies` is true, it will make defensive copies of the Buffers.
This prevents transforms piped from the PassThrough output from affecting the Buffers 
in the cached output (and visa versa). This will impact performance and memory usage,
so avoid it unless you really need it.

#### cached.createCacheStream()
                                    
Returns a `Readable` stream and immediately dumps the full contents of the cache into it.
The cache is immediately discarded to free memory.

#### cached.endPassThrough()

Stops passing data down the passthrough chanel (anything added with `cached.pipe(..)`);

#### cached.dropCache(endCacheStream)

Purges the cache if it exists. If `endCacheStream` is true, it will also trigger the `end`
event on the stream returned from `createCacheStream`.

## License

MIT © [James Talmage](http://github.com/jamestalmage)
