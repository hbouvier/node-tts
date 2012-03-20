var events = require('events'),
    util   = require('util');

module.exports = (function () {
    
    ///////////////////////////// PRIVATE  /////////////////////////////////////
    
    var verbose          = false;
    var debug            = false;

    // 
    var requestQueue     = {};
    var resourceCache    = {};
    var defaultCacheTTL  = 1000;
    var defaultCacheSize = 100;
    
    var emitThreshold    = 1000; // ms
    var lastEmit         = 0;
    
    var totalRequests       = 0;
    var totalRequestElapsed = 0;
    
    /// Stats
    var stats = {
        hit         : 0, // was in the cache
        miss        : 0, // had to fetch
        failed      : 0, // Error while fetching
        queued      : 0, // resource was already fetching and we had to wait for it
        inCache     : 0, // # in the cache now
        waiting     : 0, // RealTime: # waiting now for a resource
        fetching    : 0, // RealTime: # of resources being fetched now
        avgFetchTime: 0
    };
    
    function bufferedEmitter() {
        var now = new Date().getTime();
        if (now - lastEmit > emitThreshold) {
            this.emit.apply(this, arguments);
            lastEmit = now;
        }
    }
    
    function weedOutCache() {
        var now = new Date().getTime();
        
        var deadResource = {
            'key'    : null,
            'epoch'  : Number.MAX_VALUE,  // new Date().getTime();
            'access' : Number.MAX_VALUE,  // new Date().getTime();
            'expire' : 0,                 // defaultCacheTTL
            'hits'   : Number.MIN_VALUE
        };

        // Remove the cache element that will expire first, when multiple matches
        // expire the one with the less hits.
        for (var key in resourceCache) {
            if (resourceCache.hasOwnProperty(key)) {
                if (requestQueue[key]) // This resource cannot be removed because clients are waiting for it
                    continue;
                if (resourceCache[key].epoch + resourceCache[key].expire < now) { // has the resource expire?
                    if (deadResource.epoch + deadResource.expire < now) {// has the one we plan to remove has also expired?
                        if (resourceCache[key].hits / (now - resourceCache[key].epoch) < deadResource.hits / (now - deadResource.epoch)) { // remove the one with less hits per unit of time
                            deadResource = resourceCache[key];
                        }
                    } else { // the one marked has not expired yet, lets remove this one since it has
                        deadResource = resourceCache[key];
                    }
                        // this one has not expire, lets look if it will expire before the one we have marked
                } else if (resourceCache[key].epoch + resourceCache[key].expire < deadResource.epoch + deadResource.expire) {
                    deadResource = resourceCache[key];
                } else if (resourceCache[key].epoch + resourceCache[key].expire === deadResource.epoch + deadResource.expire &&
                           resourceCache[key].hits < deadResource.hits) { // expires at the same time, lets take the one that has been requested less
                    deadResource = resourceCache[key];
                }
            }
        }
        if (resourceCache[deadResource.key]) {
            if (debug) util.log('cache|weedOut|key='+deadResource.key);
            --stats.inCache;
            delete resourceCache[deadResource.key];
        }
        var then = new Date().getTime();
        if (then - now > 500) {
            util.log('Cache|ERROR|NODE slowdown because of the size of the cache (' + defaultCacheSize + ')');
        } else if (then - now > 100) {
            util.log('Cache|WARNING|NODE slowdown because of the size of the cache (' + defaultCacheSize + ')');
        }
        if (debug) util.log('Cache|weedOut|elapse='+ (then - now) + 'ms');
    }
    
    function execute(task) {
        var self    = this;  // The Cache class that inherits Events
        var started = new Date().getTime();
        var key     = task.shift();
        var obj     = typeof(task[0]) === 'object' ? task.shift()  : null; // if the fetch function is a class, this is the 'this'
        var fetcher = task.shift();  // the fetch function or method (if the previous parameter was an object)
        var args    = task; // All the args to be passed to the fetch function/method without the callback
        args.push(done); // We are adding the 'done' method as the callback
        ++stats.miss;
        ++stats.fetching;
        bufferedEmitter.call(this, 'stats', stats);
        fetcher.apply(obj, args); // Fetch the resource and call 'done' when it is fetched
        
        function done(err, resource) {
            totalRequestElapsed += ((new Date().getTime()) - started);
            ++totalRequests;
            stats.avgFetchTime = parseInt(totalRequestElapsed / totalRequests);
            if (err || verbose) util.log('cache|execute|done|err='+err+'|result='+(resource ? 'found':'null'));
            if (err) {
                ++stats.failed;
            }
            if (!err && defaultCacheTTL) {    // ttl ===  0 --> expire imediatly.
                if (stats.inCache >= defaultCacheSize) {
                    weedOutCache();
                }
                var now = new Date().getTime();
                resourceCache[key] = {
                    'key'   : key,
                    'epoch' : now,
                    'access': now,
                    'expire': defaultCacheTTL,
                    'hits'  : 0,
                    'data'  : resource
                };
                ++stats.inCache;
            }
            
            var pendingRequests = requestQueue[key];
            delete requestQueue[key];
            for (var i = 0, size = pendingRequests.length ; i < size ; ++i) {
                if (debug) util.log('cache|calling='+i+'|err='+err+'|resource='+(resource ? 'found':'null'));
                if (!err && defaultCacheTTL) {
                    ++resourceCache[key].hits;
                }
                pendingRequests[i].call(this, err, resource, resourceCache[key]);
                --stats.waiting;
            }
            --stats.fetching;
            if (stats.fetching === 0 && stats.waiting === 0) {
                self.emit('stats', stats);
            } else {
                bufferedEmitter.call(self, 'stats', stats);
            }
        }
    }

    /////////////////////////// PUBLIC CLASS //////////////////////////////////
    
    function Cache(size, ttl) {
        defaultCacheSize = size || defaultCacheSize;
        defaultCacheTTL  = ttl  || defaultCacheTTL;
        if (verbose) util.log('Cache|defaultCacheSize='+defaultCacheSize+'|defaultCacheTTL='+defaultCacheTTL);
        if (defaultCacheSize > 10000) {
            util.log('Cache|WARNING|Weeding out a BIG (' + defaultCacheSize + ') cache when it is full can degrade the NODE server performance since it is not async');
        }
    }
    
    util.inherits(Cache, events.EventEmitter);

    Cache.prototype.clear = function() {
        resourceCache = {};
        stats.inCache = 0;
        this.emit('stats', stats);
    };
    
    Cache.prototype.invalidate = function(key) {
        if (resourceCache[key]) {
            delete resourceCache[key];
            --stats.inCache;
        }
        this.emit('stats', stats);
    };
    
    Cache.prototype.queue = function(key) {
        var task =  Array.prototype.slice.call(arguments);
        if (task.length < 3)
            throw new Error('Cache: The first parameter has to be the key for the resource and the second parameter the "function" to obtain the resource and the last is the callback');
        var callback = task.pop();
        // The resource is in the cache
        if (resourceCache.hasOwnProperty(key)) {
            ++stats.hit;
            ++resourceCache[key].hits;
            resourceCache[key].access = new Date().getTime();
            process.nextTick(function () {
                callback(null, resourceCache[key].data, resourceCache[key]);
            });
            bufferedEmitter.call(this, 'stats', stats);
            return;
        }
        ++stats.waiting;
        if (requestQueue.hasOwnProperty(key)) {
            requestQueue[key].push(callback);
            ++stats.queued;
            bufferedEmitter.call(this, 'stats', stats);
            if (verbose) util.log('cache|queued|key='+key+'|waiting='+stats.waiting);
            return;
        }
        if (verbose) util.log('cache|fetch|key='+key);
        requestQueue[key] = [callback];
        execute.call(this, task);
    };
    
///////////////////////////////////////////////////////////////////////////////
    
    return Cache;
})();
