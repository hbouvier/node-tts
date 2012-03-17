var util = require('util'),
    cpus = require('os').cpus().length;

module.exports = (function () {
    
    ///////////////////////// PRIVATE METHODS /////////////////////////////////
    
    var executors = cpus;  // # of parallel tasks executed at the same time
    var queue     = [];
    var running   = 0;
    var debug     = true;

    function execute() {
        if (running >= executors || queue.length === 0)
            return;
        ++running;
        if (debug) util.log('funnel|execute|running='+running+'|pending='+queue.length);

        var task = queue.shift();
        var obj  = typeof(task[0]) === 'object' ? task.shift()  : null;
        var func = task.shift();
        var callback = (task.length > 0 && typeof(task[task.length -1]) === 'function') ? task.pop() : null;
        var args = task; // task.slice(1, task.length -1);
        args.push(done);
        //console.log('obj:',obj,'args:'+args+', callback:' + callback);
        func.apply(obj, args);
        
        function done(err, result) {
            var $this = this;
            --running;
            if (callback) {
                process.nextTick(function () {
                    callback.call($this, err, result);
                });
            }
            if (running < executors && queue.length > 0)
                process.nextTick(execute);
            if (debug) util.log('funnel|done|running='+running+'|pending='+queue.length);
        }
    }
    
    /////////////////////////// PUBLIC CLASS //////////////////////////////////
    
    function Funnel(nbParallelExecutors) {
        executors = nbParallelExecutors || executors;
        if (debug) util.log('funnel|executors='+executors);
    }
    
    // queue(function) or queue(function, param1,...,paramX) <- paramX must not be a function otherwise it will be taken as the callback
    // queue(function, callback) or queue(function, param1,...,paramX, callback)
    // queue(this, method) or queue(this, method, param1,...,paramX) <- paramX must not be a function otherwise it will be taken as the callback
    // queue(this, method, callback) or queue(this, method, param1,...,paramX, callback)
    Funnel.prototype.queue = function() {
        var task =  Array.prototype.slice.call(arguments);
        if (task.length < 1)
            throw new Error('Funnel: the first parameter has to be the "function" to execute');
        queue.push(task);
        if (running < executors) 
            process.nextTick(execute);
        if (debug) util.log('funnel|queue|running='+running+'|pending='+queue.length);
    };

///////////////////////////////////////////////////////////////////////////////
    
    return Funnel;
})();
