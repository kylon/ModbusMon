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
import {TCPPacketResponseOffset} from "./enums/tcpPacketResponseOffset";
import {TCPPacketOffset} from "./enums/tcpPacketOffset";
import {RegisterSizeOf} from "../enums/registerSizeOf";
import {FunctionCode} from "./enums/functionCode";
import {SockWrkCmd} from "./enums/sockWrkCmd";
import {Logger} from "../logger";
import WorkerThreads = require("node:worker_threads");
import net = require('node:net');

const mbapReadMsgLen: number = 6;
const cmdQue: SocketWorker.CMD[] = [];
let reqTimer: NodeJS.Timeout|undefined = undefined;
let expectedBytesCount: number;
let mainMsgPort: WorkerThreads.MessagePort;
let readCmdResult: SocketWorker.CMD;
let onDataTmout: number;
let sock: net.Socket;
let logger: Logger;
let uid: number;

function startReqTmout() {
    reqTimer = setTimeout((): void => {
        abortRead();
        nextCMD();

    }, onDataTmout);
}

function dataReceived(data: Buffer): void {
    clearTimeout(reqTimer);

    if (reqTimer === undefined)
        return;

    reqTimer = undefined;
    readCmdResult.buffer = Buffer.concat([readCmdResult.buffer!, data]);

    if (readCmdResult.buffer.length >= expectedBytesCount) {
        const readCount: number = readCmdResult.buffer.length;

        readCmdResult.buffer = getRegisterValuesBufferFromResponse(readCmdResult.buffer.subarray(0, expectedBytesCount));

        logger.send(`done reading ${readCount} bytes`);
        mainMsgPort.postMessage(readCmdResult);
        nextCMD();

    } else {
        startReqTmout();
    }
}

function sockError(err: any): void {
    logger.send(`socket error: ${err.code}, address: ${err.address}, port: ${err.port}, syscall: ${err.syscall}`);
    sock.destroy();
}

function sockTimeout(): void {
    logger.send('socket timeout');
    sock.destroy();
}

function sockClose(): void {
    mainMsgPort.postMessage(<SocketWorker.ConnectMsg>{tid: -1, cmd: SockWrkCmd.CONNECTION, result: false});
}

function connectSock(ip: string, port: number): Promise<boolean> {
    return (new Promise((res, _rej): void => {
        sock = net.createConnection(port, ip, function (): void {
            sock.on('data', dataReceived);
            res(true);
            nextCMD();
        });

        sock.on('error', sockError);
        sock.on('timeout', sockTimeout);
        sock.on('close', sockClose);
    }));
}

function connectTimer(tmout: number): Promise<boolean> {
    return (new Promise((res, _rej) => setTimeout(res, tmout * 1000, false)))
}

function getRegisterValuesBufferFromResponse(tcpPkt: Buffer): Buffer {
    return tcpPkt.subarray(TCPPacketResponseOffset.PDUData);
}

function getMBAPHeader(len: number, transactionId: number): Buffer {
    const mbap: Buffer = Buffer.alloc(7, 0);

    mbap.writeUInt16BE(transactionId, TCPPacketOffset.MBAPTransactionID);
    mbap.writeUInt16BE(len, TCPPacketOffset.MBAPMessageLen);
    mbap.writeInt8(uid, TCPPacketOffset.MBAPUnitID);

    return mbap;
}

function abortRead(): void {
    clearTimeout(reqTimer);
    reqTimer = undefined;
    readCmdResult.buffer = Buffer.alloc(0);

    mainMsgPort.postMessage(readCmdResult);
}

function readHoldingRegisters(start: number, nb: number, transactionId: number): void {
    const tcpPkt: Buffer = Buffer.alloc(12, 0);
    const mbap: Buffer = getMBAPHeader(mbapReadMsgLen, transactionId);

    expectedBytesCount = mbap.length + FunctionCode.sizeof + 1 + (RegisterSizeOf.U16 * nb);
    readCmdResult = <SocketWorker.CMD>{
        tid: transactionId,
        cmd: SockWrkCmd.READ_HOLDING,
        buffer: Buffer.alloc(0)
    };

    mbap.copy(tcpPkt);
    tcpPkt.writeInt8(FunctionCode.readHolding, TCPPacketOffset.PDUFunctionCode);
    tcpPkt.writeUInt16BE(start, TCPPacketOffset.PDUStartAddress);
    tcpPkt.writeUInt16BE(nb, TCPPacketOffset.PDUNumberOfRegisters);

    if (!sock.write(tcpPkt)) {
        abortRead();
        nextCMD();
        return;
    }

    startReqTmout();
    logger.send(`readHoldingRegisters: expected ${expectedBytesCount} bytes`);
}

function doCmd(): void {
    const curCmd: SocketWorker.CMD = cmdQue.shift()!;

    switch (curCmd.cmd) {
        case SockWrkCmd.READ_HOLDING:
            readHoldingRegisters(curCmd.start!, curCmd.nb!, curCmd.tid);
            break;
        default:
            logger.send(`unknown cmd ${curCmd.cmd}`);
            nextCMD();
            break;
    }
}

function nextCMD(): void {
    if (cmdQue.length === 0) {
        setTimeout(nextCMD, 200);
        return;
    }

    setTimeout(doCmd, 200);
}

WorkerThreads.parentPort!.on('message', (value: SocketWorker.InitMsg|SocketWorker.CMD): void => {
    if ('cmd' in value) {
        cmdQue.push(value);

    } else {
        logger = new Logger('socketWrk');
        mainMsgPort = value.msgPort;
        onDataTmout = value.reqTmout * 1000;
        uid = value.unitID;

        logger.connect();

        Promise.race([connectSock(value.ip, value.port), connectTimer(value.connTmout)]).then((ret: boolean): void => {
            if (!ret)
                logger.send(`socket failed to connect`);

            mainMsgPort.postMessage(<SocketWorker.ConnectMsg>{tid: value.tid, cmd: SockWrkCmd.CONNECTION, result: ret});
        });
    }
});