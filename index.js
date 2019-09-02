const Server = require("./Server").Server;
const fs = require('fs');
const express = require('express');
const util = require('util');
const app = express();
const bodyParser = require("body-parser");
const cors = require('cors');
const timeout = require('connect-timeout'); //express v4
const haltOnTimedout = require('./helpers').haltOnTimedout;
const error = require('./helpers').error;
const response = require('./helpers').response;
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
const DATE_NOW = Date.now();
const LOGS_PATH = __dirname + '/logs/logs' + DATE_NOW + '.log';
const STDOUT_PATH = __dirname + '/logs/stdout' + DATE_NOW + '.log';
const STDERR_PATH = __dirname + '/logs/errout' + DATE_NOW + '.log';

/*********************
 *    WEB LOGGING    *
 *********************/
let log_stdout = process.stdout;

let log_file = fs.createWriteStream(LOGS_PATH, {flags: 'w'});
let out_file = fs.createWriteStream(STDOUT_PATH);
let err_file = fs.createWriteStream(STDERR_PATH);

process.stdout.oldWrite = process.stdout.write;
process.stderr.oldWrite = process.stdout.write;

process.stdout.write = (a) => {
    process.stdout.oldWrite(a);
    out_file.write.bind(out_file);
};
process.stderr.write = (a) => {
    process.stderr.oldWrite(a);
    err_file.write.bind(err_file);
};

console.log = function (d) { //
    try {
        log_file.write(util.format(d) + '\n');
        log_stdout.write(util.format(d) + '\n');
        winston.log('info', d);
    } catch (e) {
        if (e.code === 'ERR_STREAM_DESTROYED')
            process.exit(e.errno);
        throw e;
    }
};

process.on('uncaughtException', function (err) {
    console.error((err && err.stack) ? err.stack : err);
});

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
        res.send(response('Sent'));

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

    if (isNaN(delay)) {
        delay = 0;
    }

    let r = {};
    let responsesReceived = 0;

    servers.forEach((server) => {
        let ip = server.ip;
        let port = server.port;


        log(`${token}: ${ip}:${port} @ ${delay}ms $ ${command}`);

        setTimeout(() => {
            let addr = `${server.ip}:${server.port}`;

            r[addr] = '';

            server.execute(command, (z) => {
                responsesReceived++;
                r[addr] = z;

                if (wait && responsesReceived === servers.length)
                    res.send(response(r));
            });
        }, delay);
    });

    if (!wait)
        res.send(response('Sent'));
});

app.get('/logs', (req, res) => {
    log('/logs routed');
    res.type('text');
    res.send(response(fs.readFileSync(LOGS_PATH, {encoding: 'utf8'})));
});

app.get('/logs_raw', (req, res) => {
    log('/logs_raw routed');
    res.type('text');
    res.send(fs.readFileSync(LOGS_PATH, {encoding: 'utf8'}));
});

app.get('/stdout', (req, res) => {
    log('/stdout routed');
    res.type('text');
    res.send(response(fs.readFileSync(STDOUT_PATH, {encoding: 'utf8'})));
});

app.get('/stderr', (req, res) => {
    log('/stderr routed');
    res.type('text');
    res.send(response(fs.readFileSync(STDERR_PATH, {encoding: 'utf8'})));
});

app.get('/kill', (req, res) => {
    log('/kill routed');
    res.type('text');
    process.exit(1);
    res.send('Killing this instance');
});


/*****************
 *    BINDING    *
 *****************/

app.listen(HTTP_PORT, () => {
    console.log('HTTP listening on ' + HTTP_PORT);
    console.log('Logging on: ' + LOGS_PATH);
    console.log('STDOUT on: ' + STDOUT_PATH);
    console.log('STDERR on: ' + STDERR_PATH);
});
