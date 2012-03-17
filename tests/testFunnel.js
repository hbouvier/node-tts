var Funnel = require('../modules/funnel.js'),
    util   = require('util'),
    spawn  = require('child_process').spawn;

function sleep(seconds, callback) {
    var command  = '/bin/sleep',
        options = {
            "cwd": "/tmp/",
            "env": {
                "ENV":"development"
            },
            "customFds":[-1, -1, -1]
        },
        args = [
            seconds || 1
        ],
        output = '';
                
    util.log('sleep='+seconds);
    var child = spawn(command, args, options);
    child.on('exit', function (code, signal) {
        //util.log('sleep|exit=' + code + '|signal=' + (signal ? signal : 'none'));
        if (code === 0) {
            callback(null);
        } else {
            callback(new Error('sleep returned ' + code + ' or signal=' + (signal ? signal : 'none') + '\n' + output + '\n'));
        }
    });
    child.stdout.on('data', function (data) {
        //util.log('sleep|stdout=' + data + '\n');
        output += 'STDOUT:'+ data + '\n';
    });
    child.stderr.on('data', function (data) {
        //util.log('sleep|stderr=' + data + '\n');
        output += 'STDERR:' + data + '\n';
    });
}


function Sleep(time) {
    this.time = time;
}

Sleep.prototype.doit = function(callback) {
    util.log('going to Sleep ' + this.time + ' seconds');
    sleep(this.time, callback);
};

Sleep.prototype.done = function(err, result) {
    ++nbExecuted;
    util.log('testFunnel: sleep(' + this.time + ' seconds) #' + nbExecuted + ' completed');
};

var funnel = new Funnel(4);
var nbExecuted = 0;

function sleepDone(err, result) {
    ++nbExecuted;
    util.log('testFunnel: sleep #' + nbExecuted + ' completed');
}

var sleep1 = new Sleep(1);
var sleep2 = new Sleep(2);
var sleep3 = new Sleep(3);
var sleep5 = new Sleep(5);
var sleep10 = new Sleep(10);


funnel.queue(sleep, 8, sleepDone);
funnel.queue(sleep, 7, sleepDone);
funnel.queue(sleep, 6, sleepDone);
funnel.queue(sleep, 5, sleepDone);

funnel.queue(sleep, 4, sleepDone);
funnel.queue(sleep, 3, sleepDone);
funnel.queue(sleep, 2, sleepDone);
funnel.queue(sleep, 1, sleepDone);



funnel.queue(sleep5, sleep5.doit, sleep5.done);
funnel.queue(sleep10, sleep10.doit, sleep10.done);
funnel.queue(sleep5, sleep5.doit, sleep5.done);
funnel.queue(sleep10, sleep10.doit, sleep10.done);
funnel.queue(sleep5, sleep5.doit, sleep5.done);
funnel.queue(sleep1, sleep1.doit, sleep1.done);
funnel.queue(sleep2, sleep2.doit, sleep2.done);
funnel.queue(sleep3, sleep3.doit, sleep3.done);


util.log('testFunnel: all done');


