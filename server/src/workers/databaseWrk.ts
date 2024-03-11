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
import {Logger} from "../logger";
import {Utils} from "../utils";
import WorkerThreads = require("node:worker_threads");
import SQLite3DB = require('better-sqlite3');
import path = require('node:path');

const dbPath: string = path.join(__dirname, '../../../user/modbusmon.db');
const cmdQue: AppWorker.CMD[] = [];
let historyMap: RegistersDataMap = new Map();
let db: SQLite3DB.Database|null = null;
let lastClean: number = Date.now();
let mainMsgPort: WorkerThreads.MessagePort;
let maxHistDays: number;
let logger: Logger;

function connectDB(): void {
    try {
        const histoTb: string = 'CREATE TABLE IF NOT EXISTS histo (addr TEXT NOT NULL, rvalue TEXT NOT NULL, dtime NUMERIC NOT NULL, PRIMARY KEY(addr,rvalue,dtime))';
        const lastTwoHrsView: string = "CREATE VIEW IF NOT EXISTS lastTwoHrs AS SELECT * FROM histo WHERE dtime > datetime('now', '-1 hour', 'localtime');";

        db = new SQLite3DB(dbPath);

        db.pragma('journal_mode = WAL');
        db.exec(histoTb);
        db.exec(lastTwoHrsView);

    } catch (e: any) {
        logger.send(`connectDB: ${e?.message}`);
    }
}

function removeOldData(): void {
    const dnow: Date = new Date();
    const twoWeeksN: number = dnow.setDate(dnow.getDate() - maxHistDays);

    if ((lastClean - twoWeeksN) < 0)
        return;

    try {
        const twoWeeksDate: App.FormattedDatetime = Utils.getFormattedDateTime(false, maxHistDays - 1);
        const stmt = db?.prepare("DELETE from histo WHERE date(dtime) <= :v1;");

        stmt?.run({v1: `${twoWeeksDate.year}-${twoWeeksDate.month}-${twoWeeksDate.day}`});
        lastClean = Date.now();

    } catch (e: any) {
        logger.send(`removeOldData: ${e?.message}`);
    }
}

function getCustomDateTime(dtime: string): string {
    return dtime.replace(',', '');
}

function doCmds(): void {
    for (let i=0,c=cmdQue.length; i<c; ++i) {
        const curCmd: AppWorker.CMD = cmdQue.shift()!;

        switch (curCmd.cmd) {
            case OpCMD.UPDATE_DB: {
                try {
                    if (!db?.open)
                        return;

                    const cmdContent: RegistersDataMap = curCmd.content as RegistersDataMap;
                    const stmt = db?.prepare("INSERT OR IGNORE INTO histo (addr, rvalue, dtime) VALUES (:v1, :v2, :v3);");
                    const now: App.FormattedDatetime = Utils.getFormattedDateTime();
                    const dateTime: string = `${now.year}-${now.month}-${now.day} ${now.hour}:${now.minute}`;

                    removeOldData();

                    for (const [reg, val] of cmdContent) {
                        const oldV: RegisterValue|undefined = historyMap.get(reg as string);

                        if (oldV !== undefined && oldV === val)
                            continue;

                        historyMap.set(reg as string, val);

                        try {
                            stmt?.run({
                                v1: reg,
                                v2: val,
                                v3: dateTime
                            });

                        } catch (e: any) {
                            logger.send(`doCmds: ${e?.message}`);
                        }
                    }
                } catch (e: any) {
                    logger.send(`doCmds: ${e?.message}`);
                }
            }
                break;
            case OpCMD.GET_DB_DATA:
                try {
                    if (!db?.open)
                        throw new Error('db is not open');

                    const cmdContent: DatabaseWorker.chartIntervalData = curCmd.content as DatabaseWorker.chartIntervalData;
                    const hasCustomInterval: boolean = cmdContent.startT !== '' && cmdContent.endT !== '';
                    const stmt = db?.prepare(hasCustomInterval ?
                        "SELECT rvalue, dtime FROM histo WHERE addr=:v1 AND dtime >= datetime(:v2) AND dtime <= datetime(:v3) ORDER BY dtime ASC;" :
                        "SELECT rvalue, dtime FROM lastTwoHrs WHERE addr=:v1 ORDER BY dtime ASC;"
                    );
                    const qres: any = stmt?.all( hasCustomInterval ?
                        {v1: cmdContent.regAdr, v2: getCustomDateTime(cmdContent.startT), v3: getCustomDateTime(cmdContent.endT)} :
                        {v1: cmdContent.regAdr}
                    );
                    const values: number[] = [];
                    const dtimes: string[] = [];

                    for (const data of qres) {
                        const floatV: number = parseFloat(data.rvalue);

                        values.push(isNaN(floatV) ? data.rvalue : floatV);
                        dtimes.push(data.dtime);
                    }

                    mainMsgPort.postMessage(<DatabaseWorker.GetDBData>{
                        id: curCmd.id,
                        cmd: curCmd.cmd,
                        results: <DatabaseWorker.parsedDBData>{vals: values, dtimes: dtimes}
                    });
                } catch (e: any) {
                    logger.send(`doCmds: ${e?.message}`);
                    mainMsgPort.postMessage(<DatabaseWorker.GetDBData>{
                        id: curCmd.id,
                        cmd: curCmd.cmd,
                        results: <DatabaseWorker.parsedDBData>{vals: [], dtimes: []}
                    });
                }
                break;
            case OpCMD.STOP: {
                db?.close();
                mainMsgPort.postMessage(curCmd);
            }
                break;
            default:
                break;
        }
    }

    startTimer();
}

function startTimer(): void {
    setTimeout(doCmds, 150);
}

WorkerThreads.parentPort!.on('message', (value: DatabaseWorker.InitMsg|AppWorker.CMD): void => {
    if ('cmd' in value) {
        cmdQue.push(value);

    } else {
        const dbConf: any = Configuration.getInstance().load('db');

        mainMsgPort = value.msgPort;
        logger = new Logger('databaseWrk');
        maxHistDays = dbConf.maxHistoryDays ? dbConf.maxHistoryDays + 1 : 15;

        logger.connect();
        connectDB();
        startTimer();
    }
});