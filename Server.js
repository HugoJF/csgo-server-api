const rcon = require('rcon');
const util = require('util');
const runCallbacks = require('./helpers').runCallbacks;

class Server {
    constructor(hostname, name, ip, port, rconPassword, receiverPort) {
        /**************
         * PROPERTIES *
         **************/
        this.hostname = hostname;
        this.name = name;
        this.ip = ip;
        this.port = port;
        this.rconPassword = rconPassword;
        this.receiverPort = receiverPort;

        /**********
         * STATES *
         **********/
        this.authed = false;

        /***********
         * HANDLES *
         ***********/
        this.connection = undefined;

        /*************
         * CALLBACKS *
         *************/
        this.responseStack = [];

        this.onConnectionAuth = [];
        this.onConnectionResponse = [];
        this.onConnectionEnd = [];
        this.onConnectionError = [];
    }

    onAuth() {
        this.log(`Authenticated RCON!`);

        this.authed = true;

        runCallbacks(this.onConnectionAuth);
    }

    onResponse(str) {
        let cb = this.responseStack.shift();

        if (util.isFunction(cb))
            cb(str);

        runCallbacks(this.onConnectionResponse, str);
    }

    onEnd(err) {
        this.log(`RCON connection ended: ${err}`);

        this.authed = false;
        this.startRconConnection();
        runCallbacks(this.onConnectionEnd, err);
    }

    onError(err) {
        this.log(`RCON errored with message: ${err}`);

        this.authed = false;
        this.startRconConnection();
        runCallbacks(this.onConnectionError, err);
    }

    startRconConnection() {
        this.connection = new rcon(this.ip, this.port, this.rconPassword);

        this.connection
            .on('auth', this.onAuth.bind(this))
            .on('response', this.onResponse.bind(this))
            .on('end', this.onEnd.bind(this))
            .on('error', this.onError.bind(this));

        this.connection.connect();
    }

    execute(command, callback) {
        this.log(`Trying to execute: ${command}`);

        if (this.authed) {
            this.syncExecute(command, callback);
        } else {
            this.onConnectionAuth.push(() => {
                this.syncExecute(command, callback);
                return true;
            });
        }
    }

    syncExecute(command, callback) {
        this.connection.send(command);

        this.responseStack.push(callback);
    }

    log(message) {
        console.log(`${this.toString()} ${message}`);
    }

    toString() {
        return `[${this.name} (${this.ip}:${this.port})]`;
    }

}

module.exports.Server = Server;