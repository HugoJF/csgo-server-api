import fs from 'fs'
import cors from 'cors'
import dotenv from 'dotenv';
import express from 'express'
import bodyParser from "body-parser"
import timeout from 'connect-timeout';
import {haltOnTimedout, response, error} from './helpers'
import {Server} from "./Server"
import Sentry from '@sentry/node';

dotenv.config({path: '../.env'});
Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

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
    let now = (new Date()).toISOString();
    console.log(`[${now}] message`);
}

function readServers() {
    let rawServers = fs.readFileSync('../servers.json', {encoding: 'utf8'});
    let svs = JSON.parse(rawServers);

    for (let obj of svs['tokens']) {
        tokens.push(obj);
    }

    for (let obj of svs['servers']) {
        let sv = new Server(obj['hostname'], obj['name'], obj['ip'], parseInt(obj['port']), obj['password'], obj['receiverPort']);
        servers.push(sv);
        sv.startRconConnection();
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

    if (!command)
        res.send(error('Command field is required'));

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

/*****************
 *    BINDING    *
 *****************/

app.listen(HTTP_PORT, () => {
    console.log('HTTP listening on ' + HTTP_PORT);
});