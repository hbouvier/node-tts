var express       = require('express'),
    util          = require('util'),
    fs            = require('fs'),
    spawn         = require('child_process').spawn,
    port          = process.env.PORT || 8082,
    app           = express.createServer(),
    cache         = __dirname + '/cache',
    version       = JSON.parse(fs.readFileSync(__dirname + "/package.json")).version;

/////////////////////////////////////////////////////////////////////////////////////////
//
// Express configuration for ALL environment
//
app.configure(function () {
    app.use(express.cookieParser());
    app.use(express.bodyParser());
    app.use(app.router);
    app.use(express.static(__dirname + '/www'));
});

/////////////////////////////////////////////////////////////////////////////////////////
//
// Express configuration for development on your local machine
//
app.configure('development', function () {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.enable('debug-log');
});

/////////////////////////////////////////////////////////////////////////////////////////
//
// Express configuration for production in HEROKU
//
app.configure('production', function () {
    //  var oneYear = 31557600000;
    //  app.use(express.static(__dirname, { maxAge: oneYear }));
    app.use(express.errorHandler());
    app.disable('debug-log');
});


app.get('/ws/tts', function (req, res) {
    var command  = '/usr/bin/say';
    var format   = '.m4a';    // '.' + req.param('format', 'm4a');
    var voice    = req.param('voice', 'Alex');
    var text     = req.param('text', 'No text passed');
    var filename = voice + '_' + format + '_' + text;
    var options = {
        "cwd": "/tmp/",
        "env": {
            "ENV":"development"
        },
        "customFds":[
            -1,
            -1,
            -1
        ]
    };
    filename = cache + '/' + filename.replace(/[^a-zA-Z0-9]/g, '_') + format;
    var args = [
        '-o', filename,
        '-v', voice,
        text
    ];

    fs.stat(filename, function (err /*, stats*/) {
        if (err) {
            var output='';
            util.log('|tts|generating|voice='+voice+'|format='+format+'|text='+text);
            var child = spawn(command, args, options);
            child.on('exit', function (code /*, signal*/) {
                util.log('|tts|generated=' + code +'|voice='+voice+'|format='+format+'|text='+text);
                if (code === 0) {
                    res.sendfile(filename);
                } else {
                    res.writeHead(404, {"Content-Type": "text/html"});
                    res.end('<html><body><pre>Unable to generate tts for ' + req.body.text + '<br/>\n' + output  + '</pre></body></html>');
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
        } else {
            util.log('|tts|cached='+filename);
            res.sendfile(filename);
        }
    });
});

/////////////////////////////////////////////////////////////////////////////////////////
//
// Start listening for clients!
//
try { fs.mkdirSync(cache); } catch (e) { } // Ignore
app.listen(port);
util.log('|tts|port=' + port + '|version='+version);
