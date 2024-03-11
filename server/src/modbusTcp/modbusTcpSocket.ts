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
import {ResolveMapType} from "./enums/resolveMapType";
import {SockWrkCmd} from "./enums/sockWrkCmd";
import {Logger} from "../logger";
import WorkerThreads = require("node:worker_threads");
import path = require("node:path");

export class ModbusTcpSocket {
    private static readonly defaultConnectionTimeout: number = 10;
    private static readonly defaultRequestTimeout: number = 5;
    private readonly socketWrkPath: string = path.join(__dirname, 'socketWrk.js');
    private readonly maxTransactionID: number = 65000;
    private sockWrkCh: WorkerThreads.MessageChannel|null;
    private sockWrk: WorkerThreads.Worker|null;
    private resolveMap: Map<number, {type: ResolveMapType, resolve: any}>;
    private connTmout: number;
    private reqTmout: number;
    private transactionID: number;
    private unitID: number;
    private port: number;
    private ip: string;
    private logger: Logger;

    constructor() {
        this.logger = new Logger('modbusTcpSocket');
        this.connTmout = ModbusTcpSocket.defaultConnectionTimeout;
        this.reqTmout = ModbusTcpSocket.defaultRequestTimeout;
        this.resolveMap = new Map<number, {type: ResolveMapType; resolve: any}>();
        this.sockWrkCh = null;
        this.sockWrk = null;
        this.transactionID = 1;
        this.unitID = 1;
        this.port = 0;
        this.ip = '';

        this.logger.connect();
    }

    private incTransactionID(): void {
        this.transactionID = (++this.transactionID) % this.maxTransactionID;
    }

    private runSocketWorker(adr: string, port: number, connTmout: number, reqTmout: number, unitID: number, tid: number): void {
        this.sockWrk = new WorkerThreads.Worker(this.socketWrkPath);
        this.sockWrkCh = new WorkerThreads.MessageChannel();

        this.sockWrk.postMessage(<SocketWorker.InitMsg>{
            tid: tid,
            unitID: unitID,
            msgPort: this.sockWrkCh.port1,
            ip: adr,
            port: port,
            connTmout: connTmout,
            reqTmout: reqTmout
        }, [this.sockWrkCh.port1]);

        this.sockWrkCh.port2.on('message', this.onSockWrkMsg.bind(this));
    }

    private onSockWrkMsg(data: SocketWorker.ConnectMsg|SocketWorker.CMD): void {
        const promRes = this.resolveMap.get(data.tid)?.resolve;

        switch (data.cmd) {
            case SockWrkCmd.CONNECTION: {
                const _data: SocketWorker.ConnectMsg = data as SocketWorker.ConnectMsg;

                if (!_data.result) {
                    this.sockWrk?.terminate();
                    this.sockWrk = null;
                    this.clearResolveMap();

                    this.connect(this.ip, this.port, this.connTmout, this.reqTmout, this.unitID).then((res: boolean): void => {
                        if (!res)
                            this.logger.send('modbusTcpSocket: failed to reconnect');
                    });
                } else if (promRes) {
                    promRes(_data.result);
                }
            }
                break;
            case SockWrkCmd.READ_HOLDING: {
                const _data: SocketWorker.CMD = data as SocketWorker.CMD;

                promRes(_data.buffer);
            }
                break;
            default:
                this.logger.send(`unknown cmd: ${data.cmd}`);
                break;
        }

        this.resolveMap.delete(data.tid);
    }

    public clearResolveMap(): void {
        for (const [_tid, res] of this.resolveMap) {
            const promRes: any = res.resolve;

            switch (res.type) {
                case ResolveMapType.BOOL:
                    promRes(false);
                    break;
                case ResolveMapType.BUFFER:
                    promRes(Buffer.alloc(0));
                    break;
                default:
                    break;
            }
        }

        this.resolveMap.clear();
    }

    public static getDefaultConnectionTimeout(): number {
        return ModbusTcpSocket.defaultConnectionTimeout;
    }

    public static getDefaultRequestTimeout(): number {
        return ModbusTcpSocket.defaultRequestTimeout;
    }

    public isConnected(): boolean {
        return (this.sockWrk !== null);
    }

    public disconnect(): void {
        this.sockWrk?.terminate();
        this.sockWrk = null;
    }

    public connect(adr: string, port: number, connectTimeout: number, requestTimeout: number, unitId: number = 1): Promise<boolean> {
        if (!adr || isNaN(port))
            return Promise.resolve(false);
        else if (this.isConnected() && this.ip === adr && this.port === port)
            return Promise.resolve(true);

        const cTmout: number = connectTimeout < 1 ? ModbusTcpSocket.defaultConnectionTimeout : connectTimeout;
        const rTmout: number = requestTimeout < 1 ? ModbusTcpSocket.defaultRequestTimeout : requestTimeout;

        this.disconnect();

        this.ip = adr;
        this.port = port;
        this.connTmout = connectTimeout;
        this.reqTmout = requestTimeout;
        this.unitID = unitId;

        return (new Promise((res, _rej): void => {
            this.incTransactionID();
            this.resolveMap.set(this.transactionID, {type: ResolveMapType.BOOL, resolve: res});
            this.runSocketWorker(adr, port, cTmout, rTmout, unitId, this.transactionID);
        }));
    }

    public readHoldingRegisters(start: number, nb: number): Promise<Buffer> {
        if (!this.isConnected())
            return Promise.resolve(Buffer.alloc(0));

        return (new Promise((res, _rej): void => {
            this.incTransactionID();
            this.resolveMap.set(this.transactionID, {type: ResolveMapType.BUFFER, resolve: res});

            this.sockWrk?.postMessage(<SocketWorker.CMD>{
                tid: this.transactionID,
                cmd: SockWrkCmd.READ_HOLDING,
                start: start,
                nb: nb
            });
        }));
    }
}