import {Rcon} from 'rcon-client';
import {executeCallbacks} from './helpers';

const RECONNECT_DELAY = 1000;

class Server {
    constructor(hostname, name, ip, port, password, receiverPort) {
        /**************
         * PROPERTIES *
         **************/
        this.hostname = hostname;
        this.name = name;
        this.ip = ip;
        this.port = port;
        this.password = password;
        this.receiverPort = receiverPort;

        /**********
         * STATES *
         **********/
        this.authed = false;
        this.connected = false;

        /***********
         * HANDLES *
         ***********/
        this.connection = undefined;

        /*************
         * CALLBACKS *
         *************/
        this.onConnected = [];
        this.onConnectionAuth = [];
        this.onConnectionError = [];
        this.onConnectionEnd = [];
    }

    handleOnConnected() {
        this.log(`Connected RCON!`);

        this.connected = true;

        executeCallbacks(this.onConnected);
    }

    handleOnAuthenticated() {
        this.log(`Authenticated RCON!`);

        this.authed = true;

        executeCallbacks(this.onConnectionAuth);
    }

    handleOnError(err) {
        this.log(`RCON errored with message: ${err}`);

        this.connected = false;
        this.authed = false;

        setTimeout(this.connect.bind(this), RECONNECT_DELAY);

        executeCallbacks(this.onConnectionError, err);
    }

    handleOnEnd() {
        this.log('RCON ended');

        this.connected = false;
        this.authed = false;

        setTimeout(this.connect.bind(this), RECONNECT_DELAY);

        executeCallbacks(this.onConnectionEnd);
    }

    handleResponse(response) {
        this.log('Response', response);
    }

    async connect() {
        this.connection = new Rcon({
            host: this.ip,
            port: this.port,
            password: this.password,
        });

        this.connection.on('connect', this.handleOnConnected.bind(this));
        this.connection.on('authenticated', this.handleOnAuthenticated.bind(this));
        this.connection.on('error', this.handleOnError.bind(this));
        this.connection.on('end', this.handleOnEnd.bind(this));

        this.connection.connect();
    }

    async execute(command) {
        this.log(`Trying to execute: ${command}`);

        // TODO: maybe use events to fully respond?
        if (!this.connected || !this.authed) {
            return null;
        }

        try {
            let response = await this.connection.send(command);

            this.handleResponse(response);

            return {
                server: this.address(),
                response
            };
        } catch (e) {
            this.handleOnError(e);

            return null;
        }
    }

    address() {
        return `${this.ip}:${this.port}`;
    }

    log(...message) {
        console.log(`${this.toString()} ${message.join(' ')}`);
    }

    toString() {
        return `[${this.name} (${this.address()})]`;
    }
}

module.exports = Server;
