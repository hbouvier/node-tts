var events = require('events'),
    util   = require('util'),
    cpus   = require('os').cpus().length;

module.exports = (function () {
    
    ///////////////////////// PRIVATE METHODS /////////////////////////////////
    
    var executors = cpus;  // # of parallel tasks executed at the same time
    var queue     = [];
    var paused    = false;
    var debug     = false;
    
    var emitThreshold    = 1000; // ms
    var lastEmit         = new Date().getTime();

    
    var totalExecTime  = 0;
    var nbExecTasks    = 0;
    var totalWaitTime  = 0;
    var totalWaitTasks = 0;
    var stats = {
        'running' : 0,
        'queued'  : 0,
        'avgWait' : 0,
        'avgExec' : 0
    };

    function execute() {
        if (paused || stats.running >= executors || stats.queued === 0)
            return;
        ++stats.running;
        if (debug) util.log('funnel|execute|running='+stats.running+'|pending='+stats.queued);

        --stats.queued;
        var self = this;
        var task = queue.shift();
        var now  = new Date().getTime();
        var waitTime = (now - task.shift());
        if (waitTime > 0) {
            totalWaitTime += waitTime;
            ++totalWaitTasks;
            stats.avgWait = parseInt(totalWaitTime / totalWaitTasks);
            
        }
        var obj  = typeof(task[0]) === 'object' ? task.shift()  : null;
        var func = task.shift();
        var callback = (task.length > 0 && typeof(task[task.length -1]) === 'function') ? task.pop() : null;
        var args = task; // task.slice(1, task.length -1);
        args.push(done);
        //console.log('obj:',obj,'args:'+args+', callback:' + callback);
        func.apply(obj, args);
        
        function done(err, result) {
            var $this = this;
            totalExecTime += ((new Date().getTime()) - now);
            ++nbExecTasks;
            stats.avgExec = parseInt(totalExecTime / nbExecTasks);
            --stats.running;
            if (callback) {
                process.nextTick(function () {
                    callback.call($this, err, result);
                });
            }
            if (stats.running < executors && stats.queued > 0) {
                process.nextTick(function () {
                   execute.call(self);
                });
            }
            if (debug) util.log('funnel|done|running='+stats.running+'|pending='+stats.queued);
            if (stats.running === 0 && stats.queued === 0) {
                self.emit('stats', stats);
            } else {
                bufferedEmitter.call(self, 'stats', stats);
            }
        }
        bufferedEmitter.call(this, 'stats', stats);
    }

    function bufferedEmitter() {
        var now = new Date().getTime();
        if (now - lastEmit > emitThreshold) {
            this.emit.apply(this, arguments);
            lastEmit = now;
        }
    }
    
    /////////////////////////// PUBLIC CLASS //////////////////////////////////
    
    function Funnel(nbParallelExecutors) {
        executors = nbParallelExecutors || executors;
        if (debug) util.log('funnel|executors='+executors);
    }
    util.inherits(Funnel, events.EventEmitter);
    
    // queue(function) or queue(function, param1,...,paramX) <- paramX must not be a function otherwise it will be taken as the callback
    // queue(function, callback) or queue(function, param1,...,paramX, callback)
    // queue(this, method) or queue(this, method, param1,...,paramX) <- paramX must not be a function otherwise it will be taken as the callback
    // queue(this, method, callback) or queue(this, method, param1,...,paramX, callback)
    Funnel.prototype.queue = function() {
        var $this = this;
        var task =  Array.prototype.slice.call(arguments);
        if (task.length < 1)
            throw new Error('Funnel: the first parameter has to be the "function" to execute');
        task.unshift(new Date().getTime());
        queue.push(task);
        ++stats.queued;
        if (paused === false && stats.running < executors) 
            process.nextTick(function () {
                execute.call($this);
            });
        if (debug) util.log('funnel|queue|running='+stats.running+'|pending='+stats.queued);
        bufferedEmitter.call(this, 'stats', stats);
    };
    
    Funnel.prototype.pause = function () {
        paused = true;
    };
    
    Funnel.prototype.resume = function () {
        var $this = this;
        if (paused) {
            paused = false;
            if (stats.running < executors) {
                process.nextTick(function () {
                    execute.call($this);
                });
            }
        }
    };

    Funnel.prototype.clear = function () {
        queue = [];
        stats.queued = 0;
    };

    Funnel.prototype.getStats = function () {
        return stats;
    };
    
    Funnel.prototype.setEmitThreshold = function (emitThresholdInMS) {
        emitThreshold = emitThresholdInMS;
    };

///////////////////////////////////////////////////////////////////////////////
    
    return Funnel;
})();
