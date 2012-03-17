var events = require('events'),
    util   = require('util');

module.exports = (function () {
    
    ///////////////////////// PRIVATE METHODS /////////////////////////////////

    var requestQueue     = {};
    var resourceCache    = {};
    var defaultCacheTTL  = 1000;
    var defaultCacheSize = 100;
    var verbose          = true;
    var debug            = true;
    
    /// Stats
    var stats = {
        hit         : 0,
        miss        : 0,
        fetch       : 0,
        waiting     : 0,
        inCache     : 0,
        fetching    : 0
    };
    
    function execute(task) {
        var self    = this;  // The Cache class that inherits Events
        var key     = task.shift();
        var obj     = typeof(task[0]) === 'object' ? task.shift()  : null; // if the fetch function is a class, this is the 'this'
        var fetcher = task.shift();  // the fetch function or method (if the previous parameter was an object)
        var args    = task; // All the args to be passed to the fetch function/method without the callback
        args.push(done); // We are adding the 'done' method as the callback
        ++stats.fetch;
        ++stats.fetching;
        this.emit('stats', stats);
        fetcher.apply(obj, args); // Fetch the resource and call 'done' when it is fetched
        
        function done(err, resource) {
            if (verbose) util.log('cache|execute|done|err='+err+'|result='+(resource ? 'found':'null'));
            if (!err && defaultCacheTTL) {    // ttl ===  0 --> expire imediatly.
                resourceCache[key] = resource;
                ++stats.inCache;
                if (stats.inCache > defaultCacheSize) {
                    if (verbose) util.log('cache|expire|key='+key);
                    resourceCache.shift();
                    --stats.inCache; // will emit at the end of the done funciton
                }
                if (defaultCacheTTL !== -1) { // ttl === -1 --> never expire
                    setTimeout(function () {
                        if (verbose) util.log('cache|expire|key='+key);
                        if (resourceCache[key]) {
                            --stats.inCache;
                            delete resourceCache[key];
                        }
                        self.emit('stats', stats);
                    }, defaultCacheTTL);
                }
            }
            
            var pendingRequests = requestQueue[key];
            delete requestQueue[key];
            for (var i = 0, size = pendingRequests.length ; i < size ; ++i) {
                if (debug) util.log('cache|calling='+i+'|err='+err+'|resource='+(resource ? 'found':'null'));
                pendingRequests[i].call(this, err, resource);
                --stats.waiting;
            }
            --stats.fetching;
            self.emit('stats', stats);
        }
    }

    /////////////////////////// PUBLIC CLASS //////////////////////////////////
    
    function Cache(size, ttl) {
        defaultCacheSize = size || defaultCacheSize;
        defaultCacheTTL  = ttl  || defaultCacheTTL;
        if (verbose) util.log('Cache|defaultCacheSize='+defaultCacheSize+'|defaultCacheTTL='+defaultCacheTTL);
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
            var resource = resourceCache[key];
            ++stats.hit;
            process.nextTick(function () {
                callback(null, resource);
            });
            this.emit('stats', stats);
            return;
        }
        ++stats.miss;
        if (requestQueue.hasOwnProperty(key)) {
            requestQueue[key].push(callback);
            ++stats.waiting;
            this.emit('stats', stats);
            if (verbose) util.log('cache|queued|key='+key+'|waiting='+stats.waiting);
            return;
        }
        if (verbose) util.log('cache|fetch|key='+key);
        requestQueue[key] = [callback];
        ++stats.waiting;
        execute.call(this, task);
    };
    
///////////////////////////////////////////////////////////////////////////////
    
    return Cache;
})();
