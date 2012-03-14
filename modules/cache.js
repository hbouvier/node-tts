// A General wrapper with cache and batch and timeouts
var util = require('util');

module.exports = function cache(fn) {
    var requestBatches = {};
    var requestCache ={};
    wrapped.cacheLifetime = 1000 * 60 *60 * 24;  // -1 == never expire
    
    function wrapped(key, callback) {
        if (requestCache.hasOwnProperty(key)) {
            var value = requestCache[key];
            process.nextTick(function () {
                callback(null, value);
            });
            return;
        }
        if (requestBatches.hasOwnProperty(key)) {
            requestBatches[key].push(callback);
            util.log('|tts|queued-file-from-cache='+key+'|queuesize='+requestBatches[key].length);
            return;
        }
        util.log('|tts|file-from-disk='+key);
        requestBatches[key] = [callback];
        fn(key, onDone);
        function onDone(err, result) {
            util.log('|tts|file-from-queue='+key+'|queuesize='+requestBatches[key].length);
            if(!err && wrapped.cacheLifetime) {
                requestCache[key] = result;
                if (wrapped.cacheLifetime !== -1) {
                    setTimeout(function () {
                        delete requestCache[key];
                    }, wrapped.cacheLifetime);
                }
            }
            var batch = requestBatches[key];
            delete requestBatches[key];
            for (var i =0, l = batch.length; i < l; i++) {
                batch[i].apply(null, arguments);
            }
        }
    }
    return wrapped;
};