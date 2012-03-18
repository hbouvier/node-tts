var express       = require('express'),
    util          = require('util'),
    tts           = require('./modules/tts').tts,
    fs            = require('fs'),
    port          = process.env.PORT || 8082,
    app           = express.createServer(),
    voice         = 'Alex',
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
    tts.play(req.param('text', 'No text passed'), 
        req.param('voice', voice),
        function (err, data) {
            if (err) {
                res.writeHead(404, {"Content-Type": "text/html"});
                res.end('<html><body><pre>Unable to generate tts <br/>\n' + err + '</pre></body></html>');
            } else {
                res.writeHead(200, {'Content-Type': 'audio/mp4'});
                res.end(data);
            }
        });
});

app.get('/ws/generate', function (req, res) {
    var async = req.param('async', 'true') === 'true' ? true : false;
    tts.play(req.param('text', 'No text passed'), 
        req.param('voice', voice),
        function (err) {
            if (async === false) {
                if (err) {
                    res.writeHead(404, {'Content-Type': 'application/json'});
                    res.end('{"result":"FAILED","async":false,"error":' + JSON.stringify(err) + '}');
                } else {
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end('{"result":"OK","async":false}');
                }
            }
        });
        if (async) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end('{"result":"OK","async":true}');
        }
});


/////////////////////////////////////////////////////////////////////////////////////////
//
// Start listening for clients!
//
tts.init();

app.listen(port);
util.log('ttsserver|port=' + port + '|version='+version);
