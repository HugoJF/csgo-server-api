const rcon = require('rcon');

class Server {
    constructor(hostname, name, ip, port, rconPassword, receiverPort) {
        this.hostname = hostname;
        this.name = name;
        this.ip = ip;
        this.port = port;
        this.rconPassword = rconPassword;
        this.receiverPort = receiverPort;

        this.authed = false;

        this.connection = undefined;

        this.onConnectionAuth = [];
        this.onConnectionResponse = [];
        this.onConnectionEnd = [];
        this.onConnectionError = [];

        this.onReceiverData = [];
        this.onReceiverInvalid = [];
    }

    boot() {
        this.startRconConnection();
    }

    onAuth() {
        this.log(`Authenticated RCON!`);

        this.authed = true;

        for (let i = this.onConnectionAuth.length - 1; i >= 0; i--) {
            let cb = this.onConnectionAuth[i];
            if (cb() === true)
                this.onConnectionAuth.splice(i, 1);
        }

    }

    onResponse(str) {
        // that.log(`Responded from RCON: ${str}`);
        for (let i = this.onConnectionResponse.length - 1; i >= 0; i--) {
            let cb = this.onConnectionResponse[i];
            if (cb(str) === true)
                this.onConnectionResponse.splice(i, 1);
        }
    }

    onEnd(err) {
        this.log(`RCON connection ended!`);

        this.startRconConnection();

        for (let i = this.onConnectionEnd.length - 1; i >= 0; i--) {
            let cb = this.onConnectionEnd[i];
            if (cb(err) === true)
                this.onConnectionEnd.splice(i, 1);
        }
    }

    onError(err) {
        this.log(`RCON errored with message: ${err}`);

        this.startRconConnection();

        for (let i = this.onConnectionError.length - 1; i >= 0; i--) {
            let cb = this.onConnectionError[i];
            if (cb(err))
                this.onConnectionError(i, 1);
        }
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

        this.onConnectionResponse.push((res) => {
            if (res instanceof Function) {
                callback(res);
            }
            return true;
        })
    }

    log(message) {
        console.log(`${this.toString()} ${message}`);
    }

    toString() {
        return `[${this.name} (${this.ip}:${this.port})]`;
    }

}

module.exports.Server = Server;