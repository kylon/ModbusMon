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
import {RegisterType} from "../enums/registerType";
import {OpCMD} from "../enums/opCMD";
import {ModbusTcpSocket} from "../modbusTcp/modbusTcpSocket";
import {clearInterval} from "node:timers";
import {Functions} from "../fn/Functions";
import {Logger} from "../logger";
import {Utils} from "../utils";
import WorkerThreads = require("node:worker_threads");

const elapsedTimerMap: Map<number, number> = new Map();
const registersData: RegistersDataMap = new Map();
const readRegCmdQue: AppWorker.CMD[] = [];
const cmdQue: AppWorker.CMD[] = [];
let paused: boolean = true;
let pullRequestMap: Map<number, Request.Register[]>;
let combinedPullRequestMap: Map<string, Request.Register[]>;
let registerClassMap: Map<string, number>;
let combinedList: Config.Combined.Parsed[];
let mainMsgPort: WorkerThreads.MessagePort;
let modbusTcp: ModbusTcpSocket;
let cmdTimer: NodeJS.Timeout;
let logger: Logger;

function initElapsedTimerMap(): void {
    const dnow: number = Math.floor(Date.now() / 1000);

    logger.send(`initializing elapsed timer map for ${pullRequestMap.size} registers`);
    elapsedTimerMap.clear();

    for (const pullReq of pullRequestMap)
        elapsedTimerMap.set(pullReq[0], dnow);
}

function readRegister(startAdr: number, readLen: number, rtype: RegisterType, bufChunkIdx: number): Promise<MonitorWorker.RegisterReadBufferChunk> {
    switch (rtype) {
        case RegisterType.HOLDING:
            return modbusTcp.readHoldingRegisters(startAdr, readLen).then((buf: Buffer): MonitorWorker.RegisterReadBufferChunk => {
                return <MonitorWorker.RegisterReadBufferChunk>{idx: bufChunkIdx, buff: buf};
            });
        case RegisterType.COIL:
        case RegisterType.INPUT:
        case RegisterType.DISCRETE:
            logger.send(`readRegister: not implemented: ${rtype}, register ${startAdr}`);
            break;
        default: // unk
            logger.send(`readRegister: unknown type: ${rtype}, register ${startAdr}`);
            break;
    }

    return Promise.resolve(<MonitorWorker.RegisterReadBufferChunk>{idx: bufChunkIdx, buff: Buffer.alloc(0)});
}

async function getRegistersData(registers: Request.Register[]): Promise<Buffer> {
    const cmpFn = (a: MonitorWorker.RegisterReadBufferChunk, b: MonitorWorker.RegisterReadBufferChunk): number => {
        return a.idx < b.idx ? -1 : (a.idx > b.idx ? 1 : 0);
    };
    const readPromList: Promise<MonitorWorker.RegisterReadBufferChunk>[] = [];
    let retBuf: Buffer;

    for (let i=0,l=registers.length; i<l; ++i) {
        const reg: Request.Register = registers.at(i)!;
        const rtype: RegisterType = reg.inputs.at(0)!.type;
        const startAdr: number = parseInt(reg.start, 16);

        readPromList.push(readRegister(startAdr, reg.len, rtype, i));
    }

    retBuf = await Promise.all(readPromList).then((values: MonitorWorker.RegisterReadBufferChunk[]): Buffer => {
        const sorted: MonitorWorker.RegisterReadBufferChunk[] = values.sort(cmpFn);
        let buff: Buffer = Buffer.alloc(0);

        for (const chunk of sorted)
            buff = Buffer.concat([buff, chunk.buff]);

        return buff;

    }).catch((e: any): Buffer => {
        logger.send(`getRegistersData: error ${e?.message}`);
        return Buffer.alloc(0);
    });

    return retBuf;
}

function readAllRegisters(): Promise<PromiseSettledResult<unknown>[]>|Promise<void> {
    const readPromList: Promise<unknown>[] = [];

    for (const [prioClass, regs] of pullRequestMap) {
        logger.send(`readAllRegisters: queueing read for class ${prioClass}, no. of registers: ${regs.length}`);

        readPromList.push(getRegistersData(regs).then((buf: Buffer): void => {
            logger.send(`readAllRegisters: start parsing class ${prioClass}, no. of registers: ${regs.length}`);
            parseRegistersRequestDataBuffer(buf, pullRequestMap.get(prioClass)!);
        }));
    }

    if (readPromList.length > 0)
        return Promise.allSettled(readPromList);

    return Promise.resolve();
}

function applyScale(rval: RegisterValue, inptScale: number): RegisterValue {
    if (typeof rval === 'string')
        return rval;

    if (typeof rval !== 'bigint' && inptScale < 1) {
        logger.send(`has scale ${inptScale}`);

        rval = parseFloat((rval * inptScale).toFixed(inptScale === 0.01 ? 2:1));
    }

    return rval;
}

function applyFn(rval: RegisterValue, inptFn: string): RegisterValue {
    if (inptFn !== '' && Utils.hasProp(Functions, inptFn)) {
        logger.send(`has parsing fn ${inptFn}, current value: ${rval}`);

        rval = Functions[inptFn](rval);
    }

    return rval;
}

function parseBuffer(buf: Buffer, regInpt: Config.Register.InputParsed, bufOff: number): RegisterValue {
    if (bufOff >= buf.length)
        throw new Error(`offset ${bufOff} is not available in buffer of size ${buf.length}`);

    let val: RegisterValue = Utils.readValueFromBuffer(buf, regInpt.size, bufOff);

    val = applyScale(val, regInpt.scale);
    val = applyFn(val, regInpt.fn);

    return val;
}

function parseRegistersRequestDataBuffer(buf: Buffer, regsList: Request.Register[]): RegistersDataMap {
    const parsedRegs: RegistersDataMap = new Map();
    const bufLen: number = buf.length;
    let bufOff: number = 0;

    if (bufLen === 0) {
        logger.send('parseRegistersRequestDataBuffer: empty buffer, return');
        return parsedRegs;
    }

    for (let i=0,l=regsList.length; i<l; ++i) {
        const reg: Request.Register = regsList[i];
        const inpts: Config.Register.InputParsed[] = reg.inputs;
        const startAdr: number = parseInt(reg.start, 16);

        if (bufOff > bufLen) {
            logger.send(`parseRegistersRequestDataBuffer: invalid offset, ${bufOff}:${bufLen} for ${reg.start}`);
            break;
        }

        logger.send(`parseRegistersRequestDataBuffer: reading buffer data of ${reg.start}, offset ${bufOff}:${bufLen}, registers: ${inpts.length}`);

        try {
            for (let j=0,h=0,jl=inpts.length; j<jl; ++j) {
                const regAdr: string = '0x' + (startAdr + h).toString(16);
                const inpt: Config.Register.InputParsed = inpts[j];
                const val: RegisterValue = parseBuffer(buf, inpt, bufOff);

                logger.send(`parseRegistersRequestDataBuffer: read buffer for address ${regAdr}`);
                updateLinkedCombineds(regAdr, val, parsedRegs);

                h += inpt.len;
                bufOff += inpt.sizeof;
                parsedRegs.set(regAdr, val);

                if (!inpt.hidden)
                    registersData.set(regAdr, val);
            }
        } catch (e: any) {
            logger.send(`parseRegistersRequestDataBuffer: failed to read buffer block for ${reg.start}: ${e?.message}`);
        }
    }

    logger.send('parseRegistersRequestDataBuffer: parse registers buffer done');
    return parsedRegs;
}

function updateLinkedCombineds(regAdr: string, rvalue: RegisterValue, parsedRegs: RegistersDataMap|null): void {
    for (const combined of combinedList) {
        if (!combined.input.regs.has(regAdr))
            continue;

        combined.input.regs.set(regAdr, rvalue);
        --combined.input.updateCounter;

        if (combined.input.updateCounter === 0) {
            let cvalue: RegisterValue = Functions[combined.input.fn](combined.input.regs);

            cvalue = applyScale(cvalue, combined.input.scale);

            combined.input.updateCounter = combined.input.regs.size;
            registersData.set(combined.adr, cvalue);

            if (parsedRegs !== null)
                parsedRegs.set(combined.adr, cvalue);
        }
    }
}

function readRegisters(): void {
    const dnow: number = Math.floor(Date.now() / 1000);
    const readPromList: Promise<unknown>[] = [];

    for (const [interval, lastElapsed] of elapsedTimerMap) {
        const elapsed: number = dnow - lastElapsed;

        if (elapsed < interval)
            continue;

        elapsedTimerMap.set(interval, Math.floor(Date.now() / 1000));

        readPromList.push(
            getRegistersData(pullRequestMap.get(interval)!).then((data: Buffer): void => {
                logger.send(`readRegisters: start parsing class ${interval}`);
                parseRegistersRequestDataBuffer(data, pullRequestMap.get(interval)!);
            })
        );
    }

    if (readPromList.length === 0) {
        startMonitor();
        return;
    }

    Promise.allSettled(readPromList).then((results: PromiseSettledResult<unknown>[]): void => {
        for (const result of results) {
            if (result.status === 'rejected')
                continue;

            const parsedDataMap: RegistersDataMap = result.value as RegistersDataMap;

            if (parsedDataMap.size > 0)
                mainMsgPort.postMessage(<AppWorker.CMD>{id: 0, cmd: OpCMD.UPDATE_DB, content: parsedDataMap});
        }

        startMonitor();

    }).catch((e: any): void => {
        logger.send(`readRegisters: error: ${e?.message}`);
        startMonitor();
    });
}

function readSingleRegister(adr: string): Promise<RegisterValue> {
    const regInpt: Config.Register.InputParsed|null = Utils.getRegisterInptFromPullMap(adr, registerClassMap, pullRequestMap);
    const iadr: number = parseInt(adr, 16);

    if (regInpt === null)
        return Promise.resolve('');

    return readRegister(iadr, regInpt.len, regInpt.type, 0).then((bufChunk: MonitorWorker.RegisterReadBufferChunk): RegisterValue => {
        try {
            const val: RegisterValue = parseBuffer(Buffer.from(bufChunk.buff), regInpt!, 0);

            updateLinkedCombineds(adr, val, null);
            registersData.set(adr, val);
            return val;

        } catch (e: any) {
            logger.send(`readSingleRegister: failed to read register ${adr}: ${e?.message}`);
            return '';
        }
    });
}

function refreshCombinedValue(id: string): Promise<RegisterValue> {
    const regs: Request.Register[]|undefined = combinedPullRequestMap.get(id);

    if (regs === undefined)
        return Promise.resolve('');

    return getRegistersData(regs).then((data: Buffer): RegisterValue => {
        logger.send(`refreshCombinedValue: start parsing id ${id}`);
        parseRegistersRequestDataBuffer(data, regs);
        return (registersData.get(id) ?? '');
    });
}

function doCmds(): void {
    if (paused)
        return;

    for (let i=0,c=cmdQue.length; i<c; ++i) {
        const curCmd: AppWorker.CMD = cmdQue.shift()!;

        switch (curCmd.cmd) {
            case OpCMD.GET_UI_DATA:
                mainMsgPort.postMessage(<MonitorWorker.UIData>{
                    id: curCmd.id,
                    cmd: curCmd.cmd,
                    isValidModbus: modbusTcp.isConnected()
                });
                break;
            case OpCMD.GET_SRV_DATA:
                mainMsgPort.postMessage(<MonitorWorker.MonitorData>{
                    id: curCmd.id,
                    cmd: curCmd.cmd,
                    regsData: [...registersData.entries()],
                    isValidModbus: modbusTcp.isConnected()
                });
                break;
            case OpCMD.STOP: {
                modbusTcp.disconnect();
                mainMsgPort.postMessage(curCmd);
            }
                break;
            case OpCMD.PAUSE_MONITOR: {
                paused = true;
                clearInterval(cmdTimer);
                mainMsgPort.postMessage(curCmd);
            }
                break;
            case OpCMD.GET_SINGLE_REG_VAL:
            case OpCMD.GET_COMBINED_VAL:
                readRegCmdQue.push(curCmd);
                break;
            default:
                break;
        }
    }
}

function doReadRegistersCmds(): any[] {
    const promList: any[] = [];

    for (let i=0,c=readRegCmdQue.length; i<c; ++i) {
        const curCmd: AppWorker.CMD = readRegCmdQue.shift()!;

        switch (curCmd.cmd) {
            case OpCMD.GET_SINGLE_REG_VAL: {
                promList.push(
                    readSingleRegister(curCmd.content as string).then((rval: RegisterValue): void => {
                        mainMsgPort.postMessage(<MonitorWorker.RefreshRegisterValue>{
                            id: curCmd.id,
                            cmd: curCmd.cmd,
                            value: rval
                        });
                    })
                );
            }
                break;
            case OpCMD.GET_COMBINED_VAL: {
                promList.push(
                    refreshCombinedValue(curCmd.content as string).then((cval: RegisterValue): void => {
                        mainMsgPort.postMessage(<MonitorWorker.RefreshRegisterValue>{
                            id: curCmd.id,
                            cmd: curCmd.cmd,
                            value: cval
                        });
                    })
                );
            }
                break;
            default:
                break;
        }
    }

    return promList;
}

function startMonitor(): void {
    if (paused) {
        return;

    } else if (!modbusTcp.isConnected()) {//todo
        logger.send('no modbus connection');
        setTimeout(startMonitor, 2000);
        return;
    }

    Promise.allSettled(doReadRegistersCmds()).then((): void => {
        setTimeout(readRegisters, 200);
    });
}

function startDoCmds(): void {
    if (paused)
        return;

    cmdTimer = setInterval(doCmds, 320);
}

WorkerThreads.parentPort!.on('message', async (value: MonitorWorker.InitMsg|MonitorWorker.SetDataMsg|AppWorker.CMD): Promise<void> => {
    if ('cmd' in value) {
        cmdQue.push(value);

    } else if ('msgPort' in value) { // init
        modbusTcp = new ModbusTcpSocket();
        logger = new Logger('monitorWrk');
        mainMsgPort = value.msgPort;

        logger.connect();

    } else { // set data
        pullRequestMap = value.pullRegsReqMap;
        combinedPullRequestMap = value.combPullRegsReqMap;
        registerClassMap = value.regClassMap;
        combinedList = value.combinedList;
        paused = false;

        initElapsedTimerMap();
        await modbusTcp.connect(value.host, value.port, value.modbusConTmout, value.modbusReqTmout);

        if (modbusTcp.isConnected()) {
            logger.send(`modbus running on ${value.host}:${value.port}`);

            if (value.fastStart !== true) {
                logger.send('fastStartup is disabled, reading all registers');
                await readAllRegisters();
                logger.send('done reading all registers');
            }

            startMonitor();

        } else {
            logger.send('modbus failed to connect');
        }

       startDoCmds();
    }
});