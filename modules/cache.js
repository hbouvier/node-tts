var util = require('util');

module.exports = (function () {
    
    ///////////////////////// PRIVATE METHODS /////////////////////////////////

    var requestQueue     = {};
    var resourceCache    = {};
    var defaultCacheTTL  = 1000;
    var defaultCacheSize = 100;
    var verbose          = true;
    var debug            = true;
    
    /// Stats
    var nbCacheHit         = 0;
    var nbCacheMiss        = 0;
    var nbFetch            = 0;
    var nbFetchInProgress  = 0;
    
    function printStats() {
        if (verbose) util.log('cache|hit=' + nbCacheHit + '|miss=' + nbCacheMiss + '|fetch='+nbFetch+'|fetching='+nbFetchInProgress+'|cacheSize='+length(resourceCache)+'|requestQueueSize='+length(requestQueue));
    }
    
    function execute(task) {
        var key = task.shift();
        var obj  = typeof(task[0]) === 'object' ? task.shift()  : null;
        var func = task.shift();
        var args = task; // All the args 
        args.push(done);
        ++nbFetch;
        ++nbFetchInProgress;
        
        func.apply(obj, args);
        
        function done(err, resource) {
            var $this = this;
            --nbFetchInProgress;
            if (verbose) util.log('cache|execute|done|err='+err+'|result='+(resource ? 'found':'null'));
            if (!err && defaultCacheTTL) {    // ttl ===  0 --> expire imediatly.
                resourceCache[key] = resource;
                if (length(resourceCache) > defaultCacheSize) {
                    if (verbose) util.log('cache|expire|key='+key);
                    resourceCache.shift();
                }
                if (defaultCacheTTL !== -1) { // ttl === -1 --> never expire
                    setTimeout(function () {
                        if (verbose) util.log('cache|expire|key='+key);
                        delete resourceCache[key];
                    }, defaultCacheTTL);
                }
            }
            
            var pendingRequests = requestQueue[key];
            delete requestQueue[key];
            for (var i = 0, size = pendingRequests.length ; i < size ; ++i) {
                if (debug) util.log('cache|calling='+i+'|err='+err+'|resource='+(resource ? 'found':'null'));
                pendingRequests[i].call($this, err, resource);
            }
            printStats();
        }
    }

    function length(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    }
    
    /////////////////////////// PUBLIC CLASS //////////////////////////////////
    
    function Cache(size, ttl) {
        defaultCacheSize = size || defaultCacheSize;
        defaultCacheTTL  = ttl  || defaultCacheTTL;
        if (verbose) util.log('Cache|defaultCacheSize='+defaultCacheSize+'|defaultCacheTTL='+defaultCacheTTL);
    }
    
    Cache.prototype.queue = function(key) {
        var task =  Array.prototype.slice.call(arguments);
        if (task.length < 3)
            throw new Error('Cache: The first parameter has to be the key for the resource and the second parameter the "function" to obtain the resource and the last is the callback');
        var callback = task.pop();
        // The resource is in the cache
        if (resourceCache.hasOwnProperty(key)) {
            var resource = resourceCache[key];
            ++nbCacheHit;
            process.nextTick(function () {
                callback(null, resource);
            });
            printStats();
            return;
        }
        ++nbCacheMiss;
        if (requestQueue.hasOwnProperty(key)) {
            requestQueue[key].push(callback);
            if (verbose) util.log('cache|queued|key='+key+'|queueSize='+length(requestQueue[key]));
            printStats();
            return;
        }
        if (verbose) util.log('cache|fetch|key='+key);
        requestQueue[key] = [callback];
        execute(task);
        printStats();
    };
    
///////////////////////////////////////////////////////////////////////////////
    
    return Cache;
})();
