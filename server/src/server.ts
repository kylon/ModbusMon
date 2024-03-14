/*
    modbusmon
    Copyright (C) 2024  kylon

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import {InverterApp} from "./app";
import helmet from "helmet";
import crypto = require('node:crypto');
import express = require('express');
import path = require('node:path');
import https = require('node:https');
import fs = require('node:fs');
import yaml = require('yaml');

const clientPath: string = path.join(__dirname, '../../client');
const confPath: string = path.join(__dirname, '../../user/cfg/server.yaml');
const userPath: string = path.join(__dirname, '../../user');
const server: express.Express = express();
let hasSec: boolean = false;
let config: any = {};
let invApp: InverterApp;
let httpServer: any;

function startServer(): void {
    try {
        if (!fs.existsSync(userPath))
            fs.mkdirSync(userPath)

        config = yaml.parse(fs.readFileSync(confPath, 'utf-8').trim());
    } catch (e: any) {
        console.log('no server config found, using defaults..');
    }

    hasSec = Object.hasOwn(config, 'sec') && config.sec === true;

    const port: number = Object.hasOwn(config, 'port') ? config.port : 8340;
    const certsPath: string = path.join(__dirname, '../../user/certs');

    if (hasSec) {
        httpServer = https.createServer({
            key: fs.readFileSync(path.join(certsPath, 'mbmon.key')),
            cert: fs.readFileSync(path.join(certsPath, 'mbmon.crt'))
        }, server);

        httpServer.listen(port, (): void => {
            console.log(`server running on port ${port}`);
            invApp = new InverterApp();
        });
    } else {
        httpServer = server.listen(port, (): void => {
            console.log(`server running on port ${port}`);
            invApp = new InverterApp();
        });
    }
}

function stopServer(): Promise<void> {
    httpServer.closeAllConnections();
    httpServer.close();

    return invApp.stopApp();
}

server.disable('x-powered-by');
server.use((_req, res: any, next): void => {
    if (hasSec)
        res.locals.nnc = crypto.randomBytes(32).toString('base64url');

    next();
});
server.use((_req, res: any, next): void => {
    if (!hasSec) {
        next();
        return;
    }

    helmet({
        xFrameOptions: false,
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'none'"],
                baseUri: ["'none'"],
                workerSrc: ["'self'"],
                styleSrc: [`'nonce-${res.locals.nnc}'`],
                scriptSrc: [`'nonce-${res.locals.nnc}'`],
                fontSrc: ["'self'"],
                imgSrc: ["'self'", "data:"]
            }
        }
    })(_req, res, next);
});
server.use(express.json());
server.use(express.static(clientPath, {index: false}));
server.set('view engine', 'ejs');
server.set('views', clientPath);

server.get('/', (_req, res: any): void => {
    res.render('index', {nonce: res.locals.nnc ?? 'none'});
});

server.get('/getcmd', (req: any, res): void => {
    switch (req.query?.scmd) {
        case 'uidata':
            invApp.getUIData().then((ret: App.UIData): void => {
                res.json(ret);

            }).catch((_e: any): void => {
                res.status(500).json({});
            });
            break;
        case 'srvlogs':
            invApp.getLogs().then((ret: App.ServerLogs): void => {
                res.json(ret);

            }).catch((_e: any): void => {
                res.status(500).json(<App.ServerLogs>{log: ''});
            });
            break;
        case 'cfgstr':
            res.json(<App.ConfigSting>{str: invApp.getConfigString(req.query?.cfg)});
            break;
        case 'pullserv':
            invApp.getServerData().then((ret: App.ServerData): void => {
                res.json(ret);
            });
            break;
        case 'getregchart':
            invApp.getRegChart(req.query?.reg, req.query?.stt, req.query?.ent).then((ret: unknown[]): void => {
                res.json(ret);
            });
            break;
        case 'rfrshreg': {
            invApp.fetchSingleRegisterValue(req.query?.adr).then((ret: RegisterValue): void => {
                res.json(<App.RefreshedRegisterValue>{value: ret});
            });
        }
            break;
        case 'rfrshcomb': {
            invApp.fetchRefreshedCombinedValue(req.query?.id).then((ret: RegisterValue): void => {
                res.json(<App.RefreshedRegisterValue>{value: ret});
            });
        }
            break;
        case 'reboot': {
            res.json({});
            stopServer().then(() => startServer());
        }
            break;
        case 'poweroff':
            process.exit(0);
        default:
            console.log('unknwon scmd');
            res.status(500).json({emsg: 'unknown command'});
            break;
    }
});

server.post('/postcmd', (req, res): void => {
    const reqData: any = req.body;
    const isValid: boolean = reqData && Object.keys(reqData).length > 0;

    if (!isValid) {
        res.status(500).json({emsg: 'command failed'});
        return;
    }

    switch (reqData.scmd) {
        case 'writecfg':
            res.json(<App.NoReturnData>{emsg: invApp.saveConfig(reqData.cfg, reqData.cfgStr) ? '':'failed to write to disk'});
            break;
        case 'writeregsort':
            res.json(<App.NoReturnData>{emsg: invApp.saveRegistersOrder(reqData.order as App.RegisterOrderData[], reqData.type) ? '':'failed to write to disk'});
            break;
        default:
            console.log('unknwon scmd');
            res.status(500).json(<App.NoReturnData>{emsg: 'unknown command'});
            break;
    }
});

for (const sig of ['SIGINT', 'SIGTERM', 'SIGQUIT']) {
    process.once(sig, (): void => {
        process.stdout.write(`\nstopping with signal ${sig}..`);

        stopServer().then((): void => {
            process.exit(0);
        });
    });
}

startServer();
