var util   = require('util'),
    spawn  = require('child_process').spawn,
    fs     = require('fs'),
    Cache  = require('./cache'),
    Funnel = require('./funnel'),
    tts    = {
        init: function () {
            this.cachePath       = __dirname + '/cache';
            this.format         = '.m4a';
            //this.regex          = /\.m4a$/;
            //this.cacheCallbacks = {};
            this.cacheFiles     = {};
            //this.ttl            = 0; // in ms, 0 == never expire
            this.funnel = new Funnel(2);  // One executor per CPU
            this.cache  = new Cache(100,1000*60*60);
    
            try { fs.mkdirSync(this.cachePath); } catch (e) { } // Ignore
            
            /*
            var files = fs.readdirSync(this.cache + '/');
            for (var index in files) {
                if (files[index].match(this.regex)) {
                    this.cacheFiles[this.cache + '/' + files[index]] = this.cache + '/' +files[index];
                }
            }
            */
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
            voice    = voice || 'Alex';
            var filename = voice + '_' + this.format + '_' + text;
            filename = this.cachePath + '/' + filename.replace(/[^a-zA-Z0-9]/g, '_') + this.format;
            util.log('tts|filename='+filename);
            this.cache.queue(filename, this, this.loadFromDisk, filename, text, voice, callback);
            
            
            //this.getWaveFromCache(filename, text, voice, callback);
        },
        /*
        getWaveFromCache : function (filename, text, voice, callback) {
            // Already in cache
            if (this.cacheFiles.hasOwnProperty(filename)) {
                var value = this.cacheFiles[filename];
                process.nextTick(function () {
                    callback(null, value);
                });
                util.log('|tts|prompt-from-cache='+filename+'|cachesize=' + this.cacheFiles.length);
                return;
            }
            // Being generated, queue ourself
            if (this.cacheCallbacks.hasOwnProperty(filename)) {
                this.cacheCallbacks[filename].push(callback);
                util.log('|tts|queue-prompt-from-cache='+filename+'|queueize=' + this.cacheCallbacks[filename].length);
                return;
            }
            // Generate it
            this.cacheCallbacks[filename] = [callback];
            this.funnel.queue(this, this.generate, filename, text, voice, generatedCallback);
            //this.generate(filename, text, voice, generatedCallback);
            
            function generatedCallback(err, result) {
                var $this = this;
                util.log('|tts|generatedCallback|err='+err+'|result='+result+'|queusize='+$this.cacheCallbacks[filename].length);
                if(!err) {
                    $this.cacheFiles[filename] = result;
                    if ($this.ttl) {
                        setTimeout(function () {
                            util.log('|tts|cache|deleting='+$this.cacheFiles[filename]);
                            delete $this.cacheFiles[filename];
                        }, $this.ttl);
                    }
                }
                var savedCallbacks = $this.cacheCallbacks[filename];
                delete $this.cacheCallbacks[filename];
                for (var i = 0, size = savedCallbacks.length; i < size; i++) {
                    savedCallbacks[i].apply(null, arguments);
                }
            }
        },
        */
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
                
            util.log('|tts|generating|voice='+voice+'|format='+this.format+'|text='+text);
            var child = spawn(command, args, options);
            child.on('exit', function (code /*, signal*/) {
                util.log('|tts|generated=' + code +'|voice='+voice+'|format='+$this.format+'|text='+text);
                if (code === 0) {
                    callback.call($this, null, filename);
                } else {
                    callback.call($this, new Error(output));
                }
            });
            child.stdout.on('data', function (data) {
                util.log('|tts|stdout=' + data + '\n');
                output += 'STDOUT:'+ data + '\n';
            });
            child.stderr.on('data', function (data) {
                util.log('|tts|stderr=' + data + '\n');
                output += 'STDERR:' + data + '\n';
            });
        }
    };
exports.tts = tts;
