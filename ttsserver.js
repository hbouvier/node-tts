var express       = require('express'),
    util          = require('util'),
    tts           = require('./modules/tts').tts,
    cache         = require('./modules/cache'),
    fs            = require('fs'),
    readFromCache = cache(fs.readFile),
    port          = process.env.PORT || 8082,
    app           = express.createServer(),
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
    tts.say(req.param('text', 'No text passed'), 
        req.param('voice', 'Alex'),
        function (err, filename) {
            util.log('|tts|get|err=' +err + '|filename=' + filename);
            readFromCache(filename, function(err, data) {
                if (err) {
                    res.writeHead(404, {"Content-Type": "text/html"});
                    res.end('<html><body><pre>Unable to generate tts <br/>\n' + err + '</pre></body></html>');
                } else {
                    res.writeHead(200, {'Content-Type': 'audio/mp4'});
                    res.end(data);
                    //res.sendfile(filename);
                }
            });
        });
});

/////////////////////////////////////////////////////////////////////////////////////////
//
// Start listening for clients!
//
tts.init();

app.listen(port);
util.log('|tts|port=' + port + '|version='+version);
