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
import {ModbusTcpSocket} from "../modbusTcp/modbusTcpSocket";
import {Configuration} from "../configuration";
import {Functions} from "../fn/Functions";
import {Logger} from "../logger";
import {Utils} from "../utils";
import WorkerThreads = require("node:worker_threads");

const configuration: Configuration.Instance = Configuration.getInstance();
const registerClassMap: Map<string, number> = new Map<string, number>();
const parsedConfig: Config.Parsed = <Config.Parsed>{};
const maxReadRegistersLim: number = 125;
let logger: Logger;

function isValidUIValue(ui: string): boolean {
    return (ui === 'batt' || ui === 'grid' || ui === 'load' || ui === 'pv' || ui === 'gridhz' || ui === 'battv');
}

function sortConfigRegisters(config: Config.Yaml): void {
    logger.send('sorting registers');

    config.registers = config.registers.sort((a: Config.Register.Register, b: Config.Register.Register): number => {
        const a1: number = parseInt(a.adr, 16);
        const a2: number = parseInt(b.adr, 16);

        return a1 < a2 ? -1 : (a1 > a2 ? 1 : 0);
    });
}

function getConfigYaml(config: any): Config.Yaml {
    if (!Utils.hasProp(config, 'host'))
        config.host = '';

    if (!Utils.hasProp(config, 'port') || isNaN(config.port))
        config.port = 502;

    if (!Utils.hasProp(config, 'hostConnectTimeout') || isNaN(config.hostConnectTimeout))
        config.hostConnectTimeout = ModbusTcpSocket.getDefaultConnectionTimeout();

    if (!Utils.hasProp(config, 'hostRequestTimeout') || isNaN(config.hostRequestTimeout))
        config.hostRequestTimeout = ModbusTcpSocket.getDefaultRequestTimeout();

    if (!Utils.hasProp(config, 'fastStartup') || config.fastStartup !== false)
        config.fastStartup = true;

    if (!Utils.hasProp(config, 'registers'))
        config.registers = [];

    if (!Utils.hasProp(config, 'combined'))
        config.combined = [];

    return config;
}

function parseRegisterEntry(registerEntry: any): void {
    if (!Utils.hasProp(registerEntry, 'interval'))
        registerEntry.interval = 6;

    if (!Utils.hasProp(registerEntry, 'unit'))
        registerEntry.unit = '';

    if (!Utils.hasProp(registerEntry, 'icon'))
        registerEntry.icon = '';

    if (!Utils.hasProp(registerEntry, 'hide') || registerEntry.hide !== true)
        registerEntry.hide = false;

    if (!Utils.hasProp(registerEntry, 'pin') || registerEntry.pin !== true)
        registerEntry.pin = false;

    if (!Utils.hasProp(registerEntry, 'ui') || !isValidUIValue(registerEntry.ui))
        registerEntry.ui = '';

    if (!Utils.hasProp(registerEntry, 'input'))
        registerEntry.input = <Config.Register.Input>{};
}

function parseRegisterEntryInput(registerEntry: any): void {
    if (!Utils.hasProp(registerEntry.input, 'type'))
        registerEntry.input.type = 'holding';

    if (!Utils.hasProp(registerEntry.input, 'scale') || isNaN(registerEntry.input.scale))
        registerEntry.input.scale = 1;

    if (!Utils.hasProp(registerEntry.input, 'size'))
        registerEntry.input.size = 'u16';

    if (!Utils.hasProp(registerEntry.input, 'fn'))
        registerEntry.input.fn = '';
}

function parseCombinedEntry(combinedEntry: any): void {
    if (!Utils.hasProp(combinedEntry, 'unit'))
        combinedEntry.unit = '';

    if (!Utils.hasProp(combinedEntry, 'icon'))
        combinedEntry.icon = '';

    if (!Utils.hasProp(combinedEntry, 'hide') || combinedEntry.hide !== true)
        combinedEntry.hide = false;

    if (!Utils.hasProp(combinedEntry, 'pin') || combinedEntry.pin !== true)
        combinedEntry.pin = false;

    if (!Utils.hasProp(combinedEntry, 'ui') || !isValidUIValue(combinedEntry.ui))
        combinedEntry.ui = '';

    if (!Utils.hasProp(combinedEntry, 'input'))
        combinedEntry.input = <Config.Combined.Input>{};
}

function parseCombinedEntryInput(combinedEntry: any): void {
    if (!Utils.hasProp(combinedEntry.input, 'fn'))
        combinedEntry.input.fn = '';

    if (!Utils.hasProp(combinedEntry.input, 'scale') || isNaN(combinedEntry.input.scale))
        combinedEntry.input.scale = 1;

    if (!Utils.hasProp(combinedEntry.input, 'links'))
        combinedEntry.input.links = [];
}

function reloadConfig(): void {
    const config: Config.Yaml = getConfigYaml(configuration.load());

    logger.send('reloading config');
    parseConfig(config);
    logger.send('config reload success');
}

function insertRegisterRequestInPullList(reqList: Request.Register[], toAddAdr: string, toAddInpt: Config.Register.InputParsed): void {
    const toAdd: number = parseInt(toAddAdr, 16);
    let merged: boolean = false;
    let pos: number = 0;

    for (let l=reqList.length; pos<l; ++pos) {
        const curReg: Request.Register = reqList[pos];
        const curr: number = parseInt(curReg.start, 16);

        if (curr === toAdd) {
            logger.send(`invalid register entry, duplicate ${curReg.start}, skip`);
            return;

        } else if ((curr + curReg.len) === toAdd && curReg.inputs.at(0)?.type === toAddInpt.type && curReg.len < maxReadRegistersLim) {
            curReg.len += toAddInpt.len;
            merged = true;

            logger.send(`merging ${toAddAdr} to ${curReg.start}, new len: ${curReg.len}`);
            break;

        } else if (toAdd < curr) {
            logger.send(`adding new register: ${toAddAdr}`);
            break;
        }
    }

    if (!merged)
        reqList.splice(pos, 0, <Request.Register>{start: toAddAdr, len: toAddInpt.len, inputs: []});

    reqList[pos].inputs.push(toAddInpt);
}

function optimizedPullRequestInsert(reg: Config.Register.Parsed): void {
    if (!parsedConfig.pullRequestMap.has(reg.interval))
        parsedConfig.pullRequestMap.set(reg.interval, []);

    const prioClass: Request.Register[] = parsedConfig.pullRequestMap.get(reg.interval)!;

    logger.send(`optimized pull request insert: class ${reg.interval}, current size: ${prioClass.length}`);
    insertRegisterRequestInPullList(prioClass, reg.adr, reg.input);
}

function optimizedCombinedPullRequestInsert(id: string, links: string[]): void {
    const sortedLinks: string[] = links.sort((a: string, b: string): number => {
        const a1: number = parseInt(a, 16);
        const a2: number = parseInt(b, 16);

        return a1 < a2 ? -1 : (a1 > a2 ? 1 : 0);
    });
    const reqs: Request.Register[] = [];

    logger.send(`optimized combined pull request: id ${id}`);

    for (let i=0,l=sortedLinks.length; i<l; ++i) {
        const toAddInpt: Config.Register.InputParsed|null = Utils.getRegisterInptFromPullMap(sortedLinks[i], registerClassMap, parsedConfig.pullRequestMap);

        if (toAddInpt === null) {
            logger.send(`null register inpt for ${sortedLinks[i]}, skip`);
            continue;
        }

        insertRegisterRequestInPullList(reqs, sortedLinks[i], toAddInpt);
    }

    parsedConfig.combinedPullRequestMap.set(id, reqs);
}

function parseConfig(config: Config.Yaml): void {
    const cmpFn = (a: Config.Register.UIParsed|Config.Combined.UIInfo, b: Config.Register.UIParsed|Config.Combined.UIInfo): number => {
        return a.order < b.order ? -1 : (a.order > b.order ? 1 : 0);
    };
    const orderData: App.RegisterOrderDataMap = configuration.load('order');

    logger.send('parsing config');

    parsedConfig.pullRequestMap = new Map<number, Request.Register[]>();
    parsedConfig.combinedPullRequestMap = new Map<string, Request.Register[]>();
    parsedConfig.uiRegInfoList = [];
    parsedConfig.inverterUIRegisters = [];
    parsedConfig.combinedList = [];

    Utils.copyObj(config, parsedConfig, ['registers', 'combined']);

    parseRegisters(config, orderData);
    parseCombined(config, orderData);

    parsedConfig.uiRegInfoList = parsedConfig.uiRegInfoList.sort(cmpFn);
    parsedConfig.uiPullTimer = (parsedConfig.uiRegInfoList.at(0) as Config.Register.Base)?.interval ?? Number.MAX_SAFE_INTEGER;

    logger.send('config parse complete');
}

function parseRegisters(config: Config.Yaml, orderData: App.RegisterOrderDataMap): void {
    if (config.registers.length === 0) {
        logger.send('no register found in config');
        return;
    }

    sortConfigRegisters(config);

    for (const reg of config.registers) {
        if (!reg.adr.startsWith('0x') && !reg.adr.startsWith('comb')) {
            logger.send(`invalid register address: ${reg.adr}, skip`);
            continue;
        }

        const parsedReg: Config.Register.Parsed = <Config.Register.Parsed>{};
        const uiRegEntry: Config.Register.UIParsed = <Config.Register.UIParsed>{};

        logger.send(`parsing ${reg.adr}`);

        parseRegisterEntry(reg);
        parseRegisterEntryInput(reg);
        Utils.copyObj(reg, parsedReg);
        Object.assign(parsedReg.input, Utils.getOptimizedRegisterSize(reg.input.size!));

        parsedReg.interval = Utils.getIntervalSeconds(reg.interval);
        parsedReg.order = (parsedReg.pin ? orderData.pinned?.[parsedReg.adr] : orderData.registers?.[parsedReg.adr]) ?? parsedReg.interval;
        parsedReg.input.type = Utils.getOptimizedRegisterType(reg.input.type!);
        parsedReg.input.scale = typeof reg.input.scale === 'string' ? parseFloat(reg.input.scale!) : reg.input.scale!;
        parsedReg.input.len = Utils.getRegisterLength(parsedReg.input.size);
        parsedReg.input.hidden = parsedReg.hide;

        registerClassMap.set(parsedReg.adr, parsedReg.interval);
        Utils.copyObj(parsedReg, uiRegEntry, ['input']);

        if (!parsedReg.hide)
            parsedConfig.uiRegInfoList.push(uiRegEntry);

        if (parsedReg.ui !== '')
            parsedConfig.inverterUIRegisters.push([parsedReg.ui, parsedReg.adr]);

        optimizedPullRequestInsert(parsedReg);

        logger.send(`[${parsedReg.adr}] parsed: size ${parsedReg.input.size}, sizeof ${parsedReg.input.sizeof}, type ${parsedReg.input.type}, interval ${parsedReg.interval}`);
    }
}

function parseCombined(config: Config.Yaml, orderData: App.RegisterOrderDataMap): void {
    if (config.combined.length === 0) {
        logger.send('no combined found in config');
        return;
    }

    let id: number = 1;

    for (const comb of config.combined) {
        const parsedComb: Config.Combined.Parsed = <Config.Combined.Parsed>{};
        const uiCombEntry: Config.Combined.UIInfo = <Config.Combined.UIInfo>{};
        const cid: string = `comb${id++}`;

        parseCombinedEntry(comb);
        parseCombinedEntryInput(comb);

        if (comb.input.links.length === 0) {
            logger.send(`no links for combined ${comb.label}`);
            continue;

        } else if (comb.input.fn === '' || !Utils.hasProp(Functions, comb.input.fn)) {
            logger.send(`invalid fn (${comb.input.fn}) for combined ${comb.label}`);
            continue;
        }

        logger.send(`parsing combined: ${comb.label}`);

        Utils.copyObj(comb, parsedComb);
        Utils.copyObj(comb, uiCombEntry, ['input']);

        parsedComb.input.regs = new Map<string, number | bigint | string>();
        parsedComb.input.scale = typeof comb.input.scale === 'string' ? parseFloat(comb.input.scale!) : comb.input.scale!;
        parsedComb.input.updateCounter = comb.input.links.length;
        parsedComb.input.cvalue = '';
        parsedComb.adr = cid;

        uiCombEntry.adr = cid;
        uiCombEntry.order = (parsedComb.pin ? orderData?.pinned?.[cid] : orderData?.registers?.[cid]) ?? Number.MAX_SAFE_INTEGER;

        for (const link of comb.input.links)
            parsedComb.input.regs.set(link, '');

        if (!parsedComb.hide)
            parsedConfig.uiRegInfoList.push(uiCombEntry);

        if (parsedComb.ui !== '')
            parsedConfig.inverterUIRegisters.push([parsedComb.ui, parsedComb.adr]);

        parsedConfig.combinedList.push(parsedComb);
        optimizedCombinedPullRequestInsert(cid, comb.input.links);

        logger.send(`[${cid}] ${parsedComb.label} parsed: fn ${parsedComb.input.fn}`);
    }
}

WorkerThreads.parentPort!.once('message', (value: ParseConfigWorker.InitMsg): void => {
    logger = new Logger('parseConfigWrk');

    logger.connect();
    reloadConfig();

    logger.flushLogs().then((): void => {
        value.msgPort.postMessage(<ParseConfigWorker.Msg>{config: parsedConfig, regClassMap: registerClassMap});
        value.msgPort.close();
        process.exit(0);
    });
});