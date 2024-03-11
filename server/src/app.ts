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
import {Configuration} from "./configuration";
import {Logger} from "./logger";
import {OpCMD} from "./enums/opCMD";
import WorkerThreads = require("node:worker_threads");
import path = require('node:path');

export class InverterApp {
    private readonly maxResolveID: number = Number.MAX_SAFE_INTEGER;
    private readonly debug: boolean;
    private orderFileCache: {pinned: Map<string, number>, registers: Map<string, number>};
    private orchestratorWrkCh: WorkerThreads.MessageChannel;
    private orchestratorWrk: WorkerThreads.Worker;
    private loggerWrkCh: WorkerThreads.MessageChannel;
    private loggerWrk: WorkerThreads.Worker;
    private configuration: Configuration.Instance;
    private resolveCmdMap: Map<number, any>;
    private logger: Logger|null;
    private resolveID: number;

    constructor() {
        this.configuration = Configuration.getInstance();

        const loggerCfg: any = this.configuration.load('logger');

        this.orderFileCache = this.configuration.load('order');
        this.debug = loggerCfg.debug === true;
        this.resolveCmdMap = new Map();
        this.resolveID = 0;
        this.logger = null;

        this.loggerWrk = new WorkerThreads.Worker(path.join(__dirname, 'workers/loggerWrk.js'));
        this.loggerWrkCh = new WorkerThreads.MessageChannel();
        this.orchestratorWrk = new WorkerThreads.Worker(path.join(__dirname, 'workers/orchestratorWrk.js'));
        this.orchestratorWrkCh = new WorkerThreads.MessageChannel();

        this.loggerWrk.postMessage(<LoggerWorker.InitMsg>{msgPort: this.loggerWrkCh.port1, cfg: loggerCfg}, [this.loggerWrkCh.port1]);
        this.loggerWrkCh.port2.on('message', this.onLoggerMsg.bind(this));
        this.orchestratorWrk.postMessage(<OrchestratorWorker.InitMsg>{msgPort: this.orchestratorWrkCh.port1}, [this.orchestratorWrkCh.port1]);
        this.orchestratorWrkCh.port2.on('message', this.onOrchestratorMsg.bind(this));

        if (this.debug) {
            this.logger = new Logger('App');

            this.logger.connect();
        }
    }

    private getNextResolveID(): number {
        this.resolveID = (++this.resolveID) % this.maxResolveID;

        return this.resolveID;
    }

    private onOrchestratorMsg(data: OrchestratorWorker.UIData|OrchestratorWorker.ServerData|DatabaseWorker.GetDBData|MonitorWorker.RefreshRegisterValue|AppWorker.CMD): void {
        const promRes = this.resolveCmdMap.get(data.id);

        switch (data.cmd) {
            case OpCMD.GET_UI_DATA: {
                const _data: OrchestratorWorker.UIData = data as OrchestratorWorker.UIData;
                const config: Config.Parsed = _data.parsedConfig;

                promRes(<App.UIData>{
                    host: config.host,
                    port: config.port,
                    isValidConn: _data.isValidModbus,
                    registerList: config.uiRegInfoList,
                    uiRegisterList: config.inverterUIRegisters,
                    pullTimer: config.uiPullTimer,
                    confStamp: _data.confStamp,
                    confList: this.configuration.getConfigFilesList()
                });
            }
                break;
            case OpCMD.GET_SRV_DATA: {
                const _data: OrchestratorWorker.ServerData = data as OrchestratorWorker.ServerData;

                promRes(<App.ServerData>{
                    isValidConnection: _data.isValidModbus,
                    addr: _data.addr,
                    port: _data.port,
                    confStamp: _data.confStamp,
                    regsData: _data.regsData
                });
            }
                break;
            case OpCMD.GET_DB_DATA: {
                const _data: DatabaseWorker.GetDBData = data as DatabaseWorker.GetDBData;

                promRes(_data.results);
            }
                break;
            case OpCMD.GET_SINGLE_REG_VAL:
            case OpCMD.GET_COMBINED_VAL: {
                const _data: MonitorWorker.RefreshRegisterValue = data as MonitorWorker.RefreshRegisterValue;

                promRes(_data.value);
            }
                break;
            case OpCMD.STOP: {
                this.orchestratorWrk.terminate();
                promRes();
            }
                break;
            default:
                promRes();
                this.logger?.send(`onOrchestratorMsg: unknown cmd ${data.cmd}`);
                break;
        }

        this.resolveCmdMap.delete(data.id);
    }

    private onLoggerMsg(data: LoggerWorker.LoggerString): void {
        const promRes = this.resolveCmdMap.get(data.id);

        switch (data.cmd) {
            case OpCMD.GET_LOGS: {
                const _data: LoggerWorker.LoggerString = data as LoggerWorker.LoggerString;

                promRes(<App.ServerLogs>{log: _data.logstr});
            }
                break;
            case OpCMD.STOP:
                this.loggerWrk.terminate();
                promRes();
                break;
            default:
                promRes();
                this.logger!.send(`onLoggerMsg: unknown cmd ${data.cmd}`);
                break;
        }

        this.resolveCmdMap.delete(data.id);
    }

    public stopApp(): Promise<void> {
        return (new Promise((stopRes, _stopRej): void => {
            const orchestratorStop: Promise<void> = new Promise((ores, _orej): void => {
                const wcmd: AppWorker.CMD = <AppWorker.CMD>{id: this.getNextResolveID(), cmd: OpCMD.STOP};

                this.resolveCmdMap.set(wcmd.id, ores);
                this.orchestratorWrk.postMessage(wcmd);
            });
            const loggerStop: Promise<void> = new Promise((lres, _lrej): void => {
                const wcmd: AppWorker.CMD = <AppWorker.CMD>{id: this.getNextResolveID(), cmd: OpCMD.STOP};

                this.resolveCmdMap.set(wcmd.id, lres);
                this.loggerWrk.postMessage(wcmd);
            });

            Promise.allSettled([orchestratorStop, loggerStop]).then((): void => {
                stopRes();
            });
        }));
    }

    public getUIData(): Promise<App.UIData> {
        return (new Promise((res, _rej): void => {
            const wcmd: AppWorker.CMD = <AppWorker.CMD>{id: this.getNextResolveID(), cmd: OpCMD.GET_UI_DATA};

            this.resolveCmdMap.set(wcmd.id, res);
            this.orchestratorWrk.postMessage(wcmd);
        }));
    }

    public getServerData(): Promise<App.ServerData> {
        return (new Promise((res, _rej): void => {
            const wcmd: AppWorker.CMD = <AppWorker.CMD>{id: this.getNextResolveID(), cmd: OpCMD.GET_SRV_DATA};

            this.resolveCmdMap.set(wcmd.id, res);
            this.orchestratorWrk.postMessage(wcmd);
        }));
    }

    public getConfigString(config: string): string {
        return this.configuration.getString(config);
    }

    public saveConfig(config: string, configStr: string): boolean {
        if (!configStr || this.configuration.hasChangedOnDisk(config))
            return false;

        const ret: boolean = this.configuration.write(configStr, config);

        if (!ret)
            this.logger?.send('saveConfig failed');

        return ret;
    }

    public saveRegistersOrder(order: App.RegisterOrderData[], type: string): boolean {
        if (order.length === 0 || type === '')
            return false;

        const ordMap: Map<string, number> = new Map<string, number>();
        let ret: boolean;

        for (const ord of order)
            ordMap.set(ord.id, ord.pos);

        if (type === 'p')
            this.orderFileCache.pinned = ordMap;
        else
            this.orderFileCache.registers = ordMap;

        ret = this.configuration.writeData(this.orderFileCache, `order`);
        if (!ret)
            this.logger?.send('saveRegistersOrder failed');

        return ret;
    }

    public getRegChart(reg: string, start: string, end: string): Promise<unknown[]> {
        return (new Promise((res, _rej): void => {
            const wcmd: AppWorker.CMD = <AppWorker.CMD>{
                id: this.getNextResolveID(),
                cmd: OpCMD.GET_DB_DATA,
                content: <DatabaseWorker.chartIntervalData>{regAdr: reg, startT: start, endT: end}
            };

            this.resolveCmdMap.set(wcmd.id, res);
            this.orchestratorWrk.postMessage(wcmd);
        }));
    }

    public fetchSingleRegisterValue(adr: string): Promise<RegisterValue> {
        return (new Promise((res, _rej): void => {
            const wcmd: AppWorker.CMD = <AppWorker.CMD>{
                id: this.getNextResolveID(),
                cmd: OpCMD.GET_SINGLE_REG_VAL,
                content: adr
            };

            this.resolveCmdMap.set(wcmd.id, res);
            this.orchestratorWrk.postMessage(wcmd);
        }));
    }

    public fetchRefreshedCombinedValue(id: string): Promise<RegisterValue> {
        return (new Promise((res, _rej): void => {
            const wcmd: AppWorker.CMD = <AppWorker.CMD>{
                id: this.getNextResolveID(),
                cmd: OpCMD.GET_COMBINED_VAL,
                content: id
            };

            this.resolveCmdMap.set(wcmd.id, res);
            this.orchestratorWrk.postMessage(wcmd);
        }));
    }

    public getLogs(): Promise<App.ServerLogs> {
        return (new Promise((res, _rej): void => {
            const wcmd: AppWorker.CMD = <AppWorker.CMD>{id: this.getNextResolveID(), cmd: OpCMD.GET_LOGS};

            this.resolveCmdMap.set(wcmd.id, res);
            this.loggerWrk.postMessage(wcmd);
        }));
    }
}