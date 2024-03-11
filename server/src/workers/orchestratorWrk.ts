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
import {Configuration} from "../configuration";
import WorkerThreads = require('node:worker_threads');
import path = require('node:path');

const parseConfigWrkPath: string = path.join(__dirname, 'parseConfigWrk.js');
const monitorWrkPath: string = path.join(__dirname, 'registersMonitorWrk.js');
const dbWrkPath: string = path.join(__dirname, 'databaseWrk.js');
const configuration: Configuration.Instance = Configuration.getInstance();
const stopPromMap: Map<string, any> = new Map();
const cmdQue: AppWorker.CMD[] = [];
let parseConfigWrkCh: WorkerThreads.MessageChannel;
let parseConfigWrk: WorkerThreads.Worker;
let mainMsgPort: WorkerThreads.MessagePort;
let monitorWrkCh: WorkerThreads.MessageChannel;
let monitorWrk: WorkerThreads.Worker;
let dbWrkCh: WorkerThreads.MessageChannel;
let dbWrk: WorkerThreads.Worker;
let config: Config.Parsed;

function runParseConfigWorker(): void {
    parseConfigWrk = new WorkerThreads.Worker(parseConfigWrkPath);
    parseConfigWrkCh = new WorkerThreads.MessageChannel();

    parseConfigWrk.postMessage(<ParseConfigWorker.InitMsg>{
        msgPort: parseConfigWrkCh.port1
    }, [parseConfigWrkCh.port1]);

    parseConfigWrkCh.port2.on('message', (value: ParseConfigWorker.Msg): void => {
        config = value.config;

        monitorWrk.postMessage(<MonitorWorker.SetDataMsg>{
            host: config.host,
            port: config.port,
            fastStart: config.fastStartup,
            modbusConTmout: config.hostConnectTimeout,
            modbusReqTmout: config.hostRequestTimeout,
            pullRegsReqMap: config.pullRequestMap,
            combPullRegsReqMap: config.combinedPullRequestMap,
            regClassMap: value.regClassMap,
            combinedList: config.combinedList
        });
        startTimer();
    });
}

function runMonitorWorker(): void {
    monitorWrk = new WorkerThreads.Worker(monitorWrkPath);
    monitorWrkCh = new WorkerThreads.MessageChannel();

    monitorWrk.postMessage(<MonitorWorker.InitMsg>{
        msgPort: monitorWrkCh.port1
    }, [monitorWrkCh.port1]);

    monitorWrkCh.port2.on('message', onMonitorWrkMsg);
}

function runDBWorker(): void {
    dbWrk = new WorkerThreads.Worker(dbWrkPath);
    dbWrkCh = new WorkerThreads.MessageChannel();

    dbWrk.postMessage(<DatabaseWorker.InitMsg>{
        msgPort: dbWrkCh.port1
    }, [dbWrkCh.port1]);

    dbWrkCh.port2.on('message', onDBWrkMessage);
}

function tick(): void {
    if (!configuration.hasChangedOnDisk() && !configuration.hasChangedOnDisk('order')) {
        startTimer();
        return;
    }

    monitorWrk.postMessage(<AppWorker.CMD>{id: -1, cmd: OpCMD.PAUSE_MONITOR});
}

function onMonitorWrkMsg(data: MonitorWorker.UIData|MonitorWorker.MonitorData|MonitorWorker.RefreshRegisterValue|AppWorker.CMD): void {
    switch (data.cmd) {
        case OpCMD.GET_UI_DATA: {
            mainMsgPort.postMessage(<OrchestratorWorker.UIData>Object.assign({
                parsedConfig: config,
                confStamp: configuration.getLastTimestamp()
            }, data as MonitorWorker.UIData));
        }
            break;
        case OpCMD.GET_SRV_DATA: {
            mainMsgPort.postMessage(<OrchestratorWorker.ServerData>Object.assign({
                addr: config.host,
                port: config.port,
                inverter: config.inverter,
                confStamp: configuration.getLastTimestamp()
            }, data as MonitorWorker.MonitorData));
        }
            break;
        case OpCMD.GET_SINGLE_REG_VAL:
        case OpCMD.GET_COMBINED_VAL:
            mainMsgPort.postMessage(data as MonitorWorker.RefreshRegisterValue);
            break;
        case OpCMD.UPDATE_DB:
            dbWrk.postMessage(data as AppWorker.CMD);
            break;
        case OpCMD.PAUSE_MONITOR:
            runParseConfigWorker();
            break;
        case OpCMD.STOP: {
            const promRes: any = stopPromMap.get('mon');

            monitorWrk.terminate();
            promRes();
        }
            break;
        default:
            break;
    }
}

function onDBWrkMessage(data: DatabaseWorker.GetDBData): void {
    switch (data.cmd) {
        case OpCMD.GET_DB_DATA:
            mainMsgPort.postMessage(data as DatabaseWorker.GetDBData);
            break;
        case OpCMD.STOP: {
            const promRes: any = stopPromMap.get('db');

            dbWrk.terminate();
            promRes();
        }
            break;
        default:
            break;
    }
}

function doCmds(): void {
    for (let i=0,c=cmdQue.length; i<c; ++i) {
        const curCmd: AppWorker.CMD = cmdQue.shift()!;

        switch (curCmd.cmd) {
            case OpCMD.GET_UI_DATA:
            case OpCMD.GET_SRV_DATA:
            case OpCMD.GET_SINGLE_REG_VAL:
            case OpCMD.GET_COMBINED_VAL:
                monitorWrk.postMessage(curCmd);
                break;
            case OpCMD.GET_DB_DATA:
                dbWrk.postMessage(curCmd);
                break;
            case OpCMD.STOP: {
                const stopMonProm: Promise<void> = new Promise((res, _rej): void => {
                    stopPromMap.set('mon', res);
                    monitorWrk.postMessage(curCmd);
                });
                const stopDbProm: Promise<void> = new Promise((res, _rej): void => {
                    stopPromMap.set('db', res);
                    dbWrk.postMessage(curCmd);
                });

                Promise.allSettled([stopMonProm, stopDbProm]).then((): void => {
                    mainMsgPort.postMessage(curCmd);
                });
            }
                break;
            default:
                break;
        }
    }
}

function startTimer(): void {
    doCmds();
    setTimeout(tick, 200);
}

WorkerThreads.parentPort!.on('message', (value: AppWorker.CMD|OrchestratorWorker.InitMsg): void => {
    if ('cmd' in value) {
        cmdQue.push(value);

    } else {
        mainMsgPort = value.msgPort;

        runMonitorWorker();
        runDBWorker();
        runParseConfigWorker();
    }
});