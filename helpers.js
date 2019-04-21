function runCallbacks(callbackList, data) {
    for (let i = callbackList.length - 1; i >= 0; i--) {
        let cb = callbackList[i];

        // Run callback, if it returns true: temporary callback
        if (cb(data) === true)
            callbackList.splice(i, 1);
    }
}

function haltOnTimedout(req, res, next) {
    if (!req.timedout) next();
    if (res.timedout) res.send(error('Timeout'))
}

function response(res, message) {
    return JSON.stringify({
        error: false,
        message: message,
        response: res
    });
}

function error(message) {
    return JSON.stringify({
        error: true,
        message: message,
    });
}


module.exports.runCallbacks = runCallbacks;
module.exports.haltOnTimedout = haltOnTimedout;
module.exports.response = response;
module.exports.error = error;