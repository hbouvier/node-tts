var util = require('util'),
    cpus = require('os').cpus().length;

module.exports = (function () {
    
    ///////////////////////// PRIVATE METHODS /////////////////////////////////
    
    var executors = cpus;  // # of parallel tasks executed at the same time
    var queue     = [];
    var running   = 0;
    
    function execute() {
        if (running >= executors || queue.length === 0) return;
        ++running;
        util.log('funnel|execute|running='+running);

        var task = queue.shift();
        var obj  = typeof(task[0]) === 'object' ? task.shift()  : null;
        var func = task.shift();
        var callback = (task.length > 0 && typeof(task[task.length -1]) === 'function') ? task.pop() : null;
        var args = task; // task.slice(1, task.length -1);
        args.push(done);
        //console.log('obj:',obj,'args:'+args+', callback:' + callback);
        func.apply(obj, args);
        
        function done(err, result) {
            --running;
            util.log('funnel|execute|done|running='+running);
            if (callback) {
                process.nextTick(function () {
                    callback.apply(obj, err, result);
                });
            }
            process.nextTick(execute);
        }
    }
    
    /////////////////////////// PUBLIC CLASS //////////////////////////////////
    
    function Funnel(nbParallelExecutors) {
        executors = nbParallelExecutors || executors;
        util.log('funnel|executors='+executors);
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
        process.nextTick(execute);
    };

///////////////////////////////////////////////////////////////////////////////
    
    return Funnel;
})();
