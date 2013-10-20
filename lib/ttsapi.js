var util    = require('util'),
    spawn   = require('child_process').spawn,
    fs      = require('fs'),
    crypto  = require('crypto'),
    Cache   = require('./cache'),
    Funnel  = require('./funnel'),
    debug   = false,
    tts     = {
        init: function () {
            this.cachePath       = __dirname + '/../cache';
            this.format         = '.m4a';
            this.cacheFiles     = {};
            this.funnel = new Funnel();  // One executor per CPU
            this.cache  = new Cache(250,1000*60*60); // One hour
            try { fs.mkdirSync(this.cachePath); } catch (e) { } // Ignore
            this.cache.on('stats', function (stats) {
                util.log('tts|cache|hit=' + stats.hit + '|miss=' + stats.miss + 
                              '|failed=' + stats.failed + 
                              '|queued=' + stats.queued + '|inCache='+stats.inCache+
                              '|fetching='+stats.fetching+'|waiting='+stats.waiting +
                              '|avgFetchTime='+stats.avgFetchTime+'ms');
            });
            this.funnel.on('stats', function (stats) {
                util.log('tts|funnel|running='+stats.running+'|queued=' + stats.queued+'|averageExecTime='+stats.avgExec+'ms|averageWaitTime='+stats.avgWait+'ms');
            });
        },
        
        loadFromDisk: function (filename, text, voice, callback) {
            var $this = this;
            fs.stat(filename, function (err) {
                if (err) {
                    $this.funnel.queue($this, $this.generate, filename, text, voice, function(/*err, filename */) {
                        fs.readFile(filename, function (err, data) {
                            $this.cacheFiles[filename] = data;
                            if (callback) {
                                process.nextTick(function() {
                                    callback(err, data);
                                });
                            }
                        });
                    });
                } else {
                    fs.readFile(filename, function (err, data) {
                        $this.cacheFiles[filename] = data;
                        if (callback) {
                            process.nextTick(function() {
                                callback(err, data);
                            });
                        }
                    });
                }
            });
        },
        
        play : function (text, voice, callback) {
            var sha1 = crypto.createHash('sha1');
            voice    = voice || 'Alex';
            sha1.update(voice + '_' + this.format + '_' + text);
            var hex = sha1.digest('hex');

            
            var filename = this.cachePath + '/' + hex + this.format;
            if (debug) util.log('tts|filename='+filename);
            this.cache.queue(filename, this, this.loadFromDisk, filename, text, voice, callback);
        },

        generate : function (filename, text, voice, callback) {
            var $this = this,
                command  = '/usr/bin/say',
                options = {
                    "cwd": "/tmp/",
                    "env": {
                        "ENV":"development"
                    },
                    "customFds":[-1, -1, -1]
                },
                args = [
                    '-o', filename,
                    '-v', voice,
                    text
                ],
                output = '';
                
            if (debug) util.log('|tts|generating|voice='+voice+'|format='+this.format+'|text='+text);
            var child = spawn(command, args, options);
            child.on('exit', function (code /*, signal*/) {
                if (debug) util.log('|tts|generated=' + code +'|voice='+voice+'|format='+$this.format+'|text='+text);
                if (code === 0) {
                    callback.call($this, null, filename);
                } else {
                    callback.call($this, new Error(output));
                }
            });
            child.stdout.on('data', function (data) {
                if (debug) util.log('|tts|stdout=' + data + '\n');
                output += 'STDOUT:'+ data + '\n';
            });
            child.stderr.on('data', function (data) {
                if (debug) util.log('|tts|stderr=' + data + '\n');
                output += 'STDERR:' + data + '\n';
            });
        }
    };
exports.tts = tts;
