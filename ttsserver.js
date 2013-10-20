var express       = require('express'),
    swagger       = require('swagger-node-express'),
    routes        = require('./lib/routes'),
    os            = require('os'),
    url           = require('url'),
    fs            = require('fs'),
    port          = process.env.PORT || 8082,
    app           = express(),
    context       = 'api/v1',
    version       = JSON.parse(fs.readFileSync(__dirname + "/package.json")).version,
    winston = require('winston'),
    logger  = new (winston.Logger)({ transports: [
        new (winston.transports.Console)({
            "level"    : "debug",
            "json"     : false,
            "colorize" : true
        })
    ]}),
    meta    = { 
        "module" : "ttsserver",
        "pid"    : process.pid,
    };

logger.log('debug', '%s|loading|module="%s|version=%s"', meta.module, meta.module, version, meta);

/////////////////////////////////////////////////////////////////////////////////////////
//
// Express configuration for ALL environment
//
app.configure(function () {
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.cookieParser());
    app.use(express.bodyParser());  // to parse the JSON body
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/www')); // HTML UI
    app.use(express.errorHandler());
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

var isSwaggerApp = (function configureSwagger() {
    var swaggerApp = express();
    // Set the main handler in swagger to the express app
    app.use('/' + context, swaggerApp);  // TODO: Context
    logger.log('debug', '%s|swagger|app.use|%s', meta.module, '/' + context, meta);  // TODO: Context
    swagger.setAppHandler(swaggerApp);

    // Serve up swagger ui at /docs via static route
    var docs_handler = express.static(__dirname + '/swagger-ui');
    app.get(/^\/docs(\/.*)?$/, function(req, res, next) {
        if (req.url === '/docs') { // express static barfs on root url w/o trailing slash
            res.writeHead(302, { 'Location' : req.url + '/' });
            res.end();
            return;
        }
        // take off leading /docs so that connect locates file correctly
        req.url = req.url.substr('/docs'.length);
        return docs_handler(req, res, next);
    });
    routes.init(swaggerApp, '/tts', swagger);   // TODO: API NAME
    
    var baseURL = process.env.BASEURL || os.hostname() + ':' + port;  // TODO: BASEURL need to be define on heroku
    swagger.configure('http://' + baseURL + '/' + context , '0.0.1'); // TODO: Context
    
    // This is a sample validator.  It simply says that for _all_ POST, DELETE, PUT
    // methods, the header `api_key` OR query param `api_key` must be equal
    // to the string literal `special-key`.  All other HTTP ops are A-OK
    swagger.addValidator(
        function validate(req, path, httpMethod) {
            //  example, only allow POST for api_key="special-key"
            if ("POST" == httpMethod || "DELETE" == httpMethod || "PUT" == httpMethod) {
                var apiKey = req.headers["x-api-key"];
                if (!apiKey) {
                    apiKey = url.parse(req.url,true).query["api_key"]; 
                }
                if ("node-tts-key-id" == apiKey) { // TODO: match swagger-ui/index.html
                    return true;
                }
                logger.log('error', '%s|swagger|X-API-KEY=%s|INVALID', meta.module, apiKey, meta);
                logger.log('info', '%s|swagger|headers=%s', meta.module, req.headers, meta);
                return false;
            }
            return true;
        }
    );
    swagger.setHeaders = function setHeaders(res) {
        res.header('Access-Control-Allow-Origin', "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT");
        res.header("Access-Control-Allow-Headers", "Content-Type, X-API-KEY");
        res.header("Content-Type", "application/json; charset=utf-8");
    };
    return true;
})();
if (!isSwaggerApp)
    routes.init(app, '/' + context); // Add the postagger URIs to Express

app.listen(port);

logger.log('verbose', '%s|Listening|port=%d', meta.module, port, meta);

