module.exports = function () {
    var winston = require('winston'),
        logger  = new (winston.Logger)({ transports: [
            new (winston.transports.Console)({
                "level"    : "info",
                "json"     : false,
                "colorize" : true
            })
        ]}),
        meta    = { 
            "module" : "rest",
            "pid"    : process.pid,
        };

    logger.log('debug', '%s|loading|module="%s"', meta.module, meta.module, meta);

    /**
     * add a route to an express application
     * 
     * @param app: an Express Application object
     * @param route: the URL route for that destination
     * @param method: either GET, POST, PUT or DELETE
     * @param destination: a function to handle that URL request
     */
    function addRoute(app, route, method, destination) {
        if (method === 'GET') {
            app.get(route, destination);
        } else if (method === 'POST') {
            app.post(route, destination);
        } else if (method === 'PUT') {
            app.put(route, destination);
        } else if (method === 'DELETE') {
            app.delete(route, destination);
        } else {
            throw new Error(meta.module + '|addRoute|EXCEPTION|unknown method:"' + method + '"|expecter=GET,POST,PUT,DELETE');
        }
        logger.log('debug', '%s|add|method=%s|route=%s', meta.module, method, route, meta);
    }
    
    /**
     * add a route to an express application
     * 
     * @param app: an Express Application object
     * @param route: the URL route for that destination
     * @param method: can be either a string or an array of HTTP method separated
     *                by a coma
     * @param destination: a function to handle that URL request
     */
    function add(app, route, method, destination) {
        var methods;
        if (typeof(method) === 'string') {
            methods = method.split(',');
        } else if(typeof(method) === 'object') {  // array
            methods = method;
        } else {
            throw new Error(meta.module + '|add|EXCEPTION|unknown method:"' + typeof(method) + '"|expecter=string,object(array)');
        }
        for (var i = 0 ; i < methods.length ; ++i) {
            addRoute(app, route, methods[i], destination);
        }
    }
    
    logger.log('debug', '%s|loaded|module="%s"', meta.module, meta.module, meta);
    return {
        "add"      : add
    };
}();




