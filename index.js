const {Server} = require("./Server");
const fs = require('fs');
const express = require('express');
const util = require('util');
const app = express();
const bodyParser = require("body-parser");
const cors = require('cors');
const timeout = require('connect-timeout'); //express v4
const {haltOnTimedout, response, error} = require('./helpers');
const dotenv = require('dotenv').config();
const {Loggly} = require('winston-loggly-bulk');
const winston = require('winston');


/***********************
 *    CONFIGURATION    *
 ***********************/

app.use(timeout(30000));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(cors());
app.use(haltOnTimedout);

/*******************
 *    CONSTANTS    *
 *******************/
const HTTP_PORT = 9000;

console.log = function (d) { //
    try {
        winston.log('info', d);
    } catch (e) {
        if (e.code === 'ERR_STREAM_DESTROYED')
            process.exit(e.errno);
        throw e;
    }
};


winston.add(new Loggly({
    token: process.env.LOGGLY_TOKEN,
    subdomain: process.env.LOGGLY_DOMAIN,
    tags: ["Winston-NodeJS"],
    json: true
}));


/*******************
 *    VARIABLES    *
 *******************/
// Server data
let servers = [];
let tokens = [];

// TODO: update with foreach
function getServer(ip, port) {
    for (let i = 0; i < servers.length; i++) {
        if (servers[i].ip === ip && servers[i].port === port) {
            return servers[i];
        }
    }

    return undefined;
}

function log(message) {
    console.log(message);
}

function readServers() {
    let rawServers = fs.readFileSync('servers.json', {encoding: 'utf8'});
    let svs = JSON.parse(rawServers);

    for (let obj of svs['servers']) {
        let sv = new Server(obj['hostname'], obj['name'], obj['ip'], parseInt(obj['port']), obj['password'], obj['receiverPort']);
        servers.push(sv);
        sv.startRconConnection();
    }

    for (let obj of svs['tokens']) {
        tokens.push(obj);
    }
}

function validateToken(req, res) {
    let token = req.query.token;

    if (tokens.indexOf(token) === -1) {
        log(`${token}: Invalid token`);
        res.send(error('Invalid token'));
        return false;
    } else {
        return true;
    }
}

/**********************
 *    STATIC CALLS    *
 **********************/

readServers();

/***************
 *    PAGES    *
 ***************/

// Used to log messages to the web-console
app.get('/consoleLog', (req, res) => {
    log('/consoleLog routed');
    log(req.query.message);
    res.send(response('Logged'));
});

app.get('/send', (req, res) => {
    if (!validateToken(req, res)) return;

    let ip = req.query.ip;
    let port = req.query.port;
    let command = req.query.command;
    let delay = req.query.delay;
    let token = req.query.token;
    let wait = req.query.wait;

    delay = parseInt(delay);

    if (isNaN(delay)) {
        delay = 0;
    }


    let server = getServer(ip, parseInt(port));

    if (!server) {
        res.send(error('Server could not be found!'));
        return;
    }

    log(`${token}: ${ip}:${port} @ ${delay}ms $ ${command}`);

    setTimeout(() => {
        server.execute(command, (r) => {
            if (wait) res.send(response(r));
        });
    }, delay);

    if (!wait)
        res.send(response(true));
});

app.get('/list', (req, res) => {
    if (!validateToken(req, res)) return;

    let token = req.query.token;

    let serializedFields = ['hostname', 'name', 'ip', 'port'];

    log(`${token}: Requested server listing`);

    let svs = servers.map((sv) => (
        serializedFields.reduce((acc, cur) => {
            acc[cur] = sv[cur];
            return acc;
        }, {})
    ));

    res.send(response(svs));
});

app.get('/sendAll', (req, res) => {
    if (!validateToken(req, res)) return;

    let command = req.query.command;
    let token = req.query.token;
    let delay = req.query.delay;
    let wait = req.query.wait;

    delay = parseInt(delay);

    if (isNaN(delay))
        delay = 0;

    let responseBody = {};
    let responsesReceived = 0;

    log(`Sending ${servers.length} commands...`);
    servers.forEach((server) => {
        let ip = server.ip;
        let port = server.port;


        log(`${token}: ${ip}:${port} @ ${delay}ms $ ${command}`);

        setTimeout(() => {
            let addr = `${server.ip}:${server.port}`;

            responseBody[addr] = '';

            server.execute(command, (z) => {
                responsesReceived++;
                responseBody[addr] = z;
                log(`Received response from ${addr}. Received: ${responsesReceived}/${servers.length}`);

                if (wait && responsesReceived === servers.length)
                    res.send(response(responseBody));
            });
        }, delay);
    });

    if (!wait)
        res.send(response('Sent'));
});

app.get('/kill', (req, res) => {
    log('/kill routed');
    res.type('text');
    res.send('Killing this instance');
    process.exit(1);
});

/*****************
 *    BINDING    *
 *****************/

app.listen(HTTP_PORT, () => {
    console.log('HTTP listening on ' + HTTP_PORT);
});