module.exports = function () {
    var router  = require('./util/router'),
        util    = require('util'),
        tts     = require('./ttsapi').tts,
        format  = '.{format}',
        voice   = 'Alex',
        voices  = ['Agnes','Albert','Alex','Bad','Bahh','Bells','Boing','Bruce','Bubbles','Cellos','Deranged','Fred','Good','Hysterical','Junior','Kathy','Pipe','Princess','Ralph','Trinoids','Vicki','Victoria','Whisper','Zarvox'],
        winston = require('winston'),
        logger  = new (winston.Logger)({ transports: [
            new (winston.transports.Console)({
                "level"    : "debug",
                "json"     : false,
                "colorize" : true
            })
        ]}),
        meta    = { 
            "module" : "routes",
            "pid"    : process.pid,
        };

    logger.log('debug', '%s|loading|module="%s"', meta.module, meta.module, meta);

    function fix(err) {
        err.message = err.reason;
        return err;
    }

    /**
     * initialize the routes that the Express Application will serve
     * 
     * @param app: an Express Application object
     * @param context: All the URL will start with that context prefix (e.g.
     *                 "/api/..." or "/webservice/...")
     */
    function init(app, context, swagger) {
        logger.log('debug', '%s|adding|routes|context=%s' + (swagger ? "|SWAGGER" : ""), meta.module, context, meta);
        if (swagger) {
            describeModels(swagger);
            swagger.addGET({
                'spec': {
                    "description" : "Text To Speech REST API",
                    "path" : context + format + '/play/{voice}/{text}', 
                    "notes" : "The REST API /play/ transform a text phrase into a spoken audio stream playable through an HTML5 <audio> element. You can pre-generate the audio by calling the REST API /generate/ before calling this one, to have the audio start playing as soon as you call the /play/ API.",
                    "method": "GET",
                    "summary" : "Transform a text phrase into an Audio Stream.",
                    "nickname" : "play",
                    "responseClass" : "BinaryAudioStream",
                    "produces" : ["audio/mp4","application/json"],
                    "params" : [
                        swagger.params.path(
                            "voice", 
                            "A 'human' voice to use, to speak the phrase", 
                            "string",
                            {"values": voices,"valueType":"LIST"},
                            "Alex"
                        ),
                        swagger.params.path("text", "The text phrase to be spoken.", "string")
                    ],
                    "errorResponses" : [
                        fix(swagger.errors.notFound('voice')),
                        fix(swagger.errors.notFound('text')),
                        fix(swagger.errors.invalid('voice'))
                    ]
                },
                'action': function(req, res) {
                    logger.log('debug', '%s|say|voice=%s|text=%s', meta.module, req.params.voice, req.params.text, meta);
                    if (voices.indexOf(req.params.voice) < 0) {
                        swagger.stopWithError(res, {code:400,reason:'The voice ' + req.params.voice + ' is not supported'});
                        return;
                    }
                    tts.play(req.param('text', 'No text passed'), 
                                req.param('voice', voice),
                                function (err, data) {
                                    if (err) {
                                        if (!err.code || !err.reason)
                                            err = {code : 500, reason:util.inspect(err)};
                                        swagger.stopWithError(res, err);
                                    } else {
                                        res.writeHead(200, {'Content-Type': 'audio/mp4'});
                                        res.end(data);
                                    }
                                });
                }
            }).addPost({
                'spec': {
                    "description" : "Text To Speech REST API",
                    "path" : context + format + '/generate',
                    "notes" : "To avoid latency, when using the REST API /play/, you can pre-generate the audio on the server by calling this API.",
                    "method": "POST",
                    "summary" : "Generate the audio on the server.",
                    "nickname" : "generate",
                    "responseClass" : "Status",
                    "params" : [
                        swagger.params.body("params", "The text phrase to be pre-generated on the server", 'TextToSpeech', '{"voice" : "Alex", "text":"Hello world", "async" : true}')
                    ],
                    "errorResponses" : [
                        fix(swagger.errors.notFound('voice')),
                        fix(swagger.errors.notFound('text')),
                        fix(swagger.errors.invalid('voice')),
                        fix(swagger.errors.invalid('async'))
                    ]
                },
                'action': function(req, res) {
                    if (!req.body) {
                        swagger.stopWithError(res, {code:400,reason:'The BODY of the request is empty'});
                        return;
                    }
                    logger.log('debug', '%s|generate|voice=%s|text=%s|async=%s', meta.module, req.body.voice, req.body.text, req.body.async, meta);
                    if (voices.indexOf(req.body.voice) < 0) {
                        swagger.stopWithError(res, {code:400,reason:'The voice ' + req.params.voice + ' is not supported'});
                        return;
                    }
                    var async;
                    if (typeof req.body.async != 'undefined') {
                        if (req.body.async === true || req.body.async === 'true') {
                            async = true;
                        } else if (req.body.async === false || req.body.async === 'false') {
                            async = false;
                        } else {
                            swagger.stopWithError(res, {code:400,reason:'The async must be true or false'});
                            return;
                        }
                    } else
                        async = false;
                    
                    tts.play(req.param('text', 'No text passed'), 
                        req.param('voice', voice),
                        function (err) {
                            if (async === false) {
                                if (err) {
                                    if (!err.code || !err.reason)
                                        err = {code : 500, reason:util.inspect(err)};
                                    swagger.stopWithError(res, err);
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
                }
            });
        } else {
            router.add(app, context + '/tts.json/play', 'GET', function (req, res) {
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
            router.add(app, context + '/tts.json/generate', 'POST',  function (req, res) {
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
        }
        tts.init();
    }
    
    function describeModels(swagger) {
        swagger.addModels({
            "Status" : {
                "id" : "Status",
                "properties" : {
                    "result" : { "type" : "string", "required" : true },
                    "async"  : { "type" : "boolean", "required" : true }
                }
            },
            "BinaryAudioStream": {
                "id": "BinaryAudioStream",
                "properties": {
                    "AudioStream": {
                        "items": {
                            "type": "byte"
                        },
                        "type": "Array",
                        "required" : true
                    }
                }
            },
            "TextToSpeech" : {
                "id" : "TextToSpeech",
                "properties" : {
                    "voice" : { "type" : "string", "required" : true },
                    "text"  : { "type" : "string", "required" : true },
                    "async" : { "type" : "boolean", "required" : false }
                }
            }
        });
    }

    logger.log('debug', '%s|loaded|module="%s"', meta.module, meta.module, meta);
    return {
        "init"     : init,
    };
}();




