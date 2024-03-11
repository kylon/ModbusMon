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
import {OpCMD} from "../enums/opCMD";
import WorkerThreads = require("node:worker_threads");
import {Utils} from "../utils";
import fs = require('node:fs');
import path = require('node:path');
import net = require('node:net');

const connectionMap: Map<number, net.Socket> = new Map<number, net.Socket>();
const logPath: string = path.join(__dirname, '../../../user/log.txt');
const maxID: number = Number.MAX_SAFE_INTEGER;
const cmdQue: AppWorker.CMD[] = [];
const tmpBuf: Buffer[] = [];
let server: net.Server|null = null;
let debugEnable: boolean = false;
let logFd: number|null = null;
let connectionID: number = 0;
let maxFileSize: number = 0;
let mainMsgPort: WorkerThreads.MessagePort;

function getNextConnectionID(): number {
    connectionID = (++connectionID) % maxID;

    return connectionID;
}

function initLogFile(): void {
    if (!debugEnable)
        return;

    try {
        const old: string = `${logPath}_old`;

        if (!fs.existsSync(logPath))
            return;

        if (fs.existsSync(old))
            fs.unlinkSync(old);

        fs.renameSync(logPath, old);

    } catch (e: any) {
        debugEnable = false;
        console.log(`Logger: init fail: ${e?.message}`);
    }
}

function resizeFile(): void {
    if (!logFd)
        return;

    try {
        const stat: fs.Stats = fs.fstatSync(logFd);
        const sz: number = stat.size;

        if (sz < maxFileSize)
            return;

        fs.closeSync(logFd);
        initLogFile();

        logFd = fs.openSync(logPath, 'a+');

    } catch (e: any) {
        stop();
        console.log(`Logger: failed to resize log: ${e?.message}`);
    }
}

function writeLog(): void {
    if (logFd === null || tmpBuf.length === 0)
        return;

    try {
        fs.appendFileSync(logFd, tmpBuf.shift()!);

    } catch (e: any) {
        console.log(`Logger: failed to write log ${e?.message}`);
    }
}

function stop(): void {
    server?.close();

    for (const [_cid, sk] of connectionMap)
        sk.destroy();

    if (logFd)
        fs.closeSync(logFd);

    logFd = null;

    while (cmdQue.pop() !== undefined);
    while (tmpBuf.pop() !== undefined);
}

function start(): void {
    try {
        logFd = fs.openSync(logPath, 'a+');
        console.log(`Logger: logger server is ready to output to ${logPath}`);

    } catch (e: any) {
        console.log(`Logger: failed to open log file: ${e?.message}`);
        stop();
    }
}

function doCMDs(): void {
    const curCmd: AppWorker.CMD = cmdQue.shift()!;

    switch (curCmd.cmd) {
        case OpCMD.GET_LOGS: {
            const ret: LoggerWorker.LoggerString = <LoggerWorker.LoggerString>{
                cmd: curCmd.cmd,
                id: curCmd.id,
                logstr: ''
            };

            try {
                if (logFd) {
                    fs.fdatasyncSync(logFd);

                    ret.logstr = fs.readFileSync(logPath, {encoding: 'utf-8'}); //wtf

                } else {
                    ret.logstr = fs.readFileSync(logPath, {encoding: 'utf-8'});
                }
            } catch (e: any) {
                console.log(`Logger: failed to read logs ${e?.message}`);
            }

            mainMsgPort.postMessage(ret);
            nextTick();
        }
            break;
        case OpCMD.STOP: {
            try {
                if (logFd)
                    fs.fdatasyncSync(logFd);

                stop();
                mainMsgPort.postMessage(curCmd);
            } catch (e: any) {
                mainMsgPort.postMessage(curCmd);
            }
        }
            break;
        default: {
            console.log(`loggerWrk: unknown cmd ${curCmd.cmd}`);
            nextTick();
        }
            break;
    }
}

function nextTick(): void {
    if (cmdQue.length === 0) {
        resizeFile();
        writeLog();
        setTimeout(nextTick, 250);
        return;
    }

    setTimeout(doCMDs, 250);
}

WorkerThreads.parentPort!.on('message', (value: LoggerWorker.InitMsg|AppWorker.CMD): void => {
    if ('cmd' in value) {
        cmdQue.push(value);

        if (!debugEnable)
            doCMDs();

    } else {
        mainMsgPort = value.msgPort;
        debugEnable = value.cfg.debug === true;
        maxFileSize = Utils.sizeStrToBytes(value.cfg.maxFileSize ?? '200mb');

        initLogFile();

        server = net.createServer((sock: net.Socket): void => {
            if (!debugEnable) {
                sock.end();
                return;
            }

            const cid: number = getNextConnectionID();

            connectionMap.set(cid, sock);

            sock.on('end', (): void => {
                connectionMap.delete(cid);
            });

            sock.on('data', (data: Buffer): void => {
                tmpBuf.push(data);
            });
        });

        server.on('error', (e: Error): void => {
            console.log(`Logger: ${e.name}: ${e.message}`);
            stop();
        });

        server.listen('\0loggersock', (): void => {
            if (debugEnable)
                start();
        });

        if (debugEnable)
            nextTick();
    }
});