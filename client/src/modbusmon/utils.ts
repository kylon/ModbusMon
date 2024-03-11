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
import {PinnedRegisterPanel} from "./registerPanels/PinnedRegisterPanel.ts";
import {OthersRegisterPanel} from "./registerPanels/OthersRegisterPanel.ts";
import {LogsModal} from "./modals/LogsModal.ts";

function padDateTimeNumber(dt: number): string {
    return dt.toString().padStart(2, '0');
}

export function hasProp(obj: object, prop: string): boolean {
    return obj && obj.hasOwnProperty(prop);
}

export function cloneTemplate<Type>(id: string): Type {
    const template: DocumentFragment = document.querySelector<HTMLTemplateElement>(`#${id}`)!.content;

    return template.cloneNode(true) as Type;
}

export function toggleLoadingScreen(loadingDiv: HTMLDivElement, show: boolean): void {
    if (show)
        loadingDiv.classList.remove('hidden');
    else
        loadingDiv.classList.add('hidden');
}

export function dispatchAppReloadRequest(): void {
    document.dispatchEvent(new Event('reloadAppEvt'));
}

export function dispatchServerRestartRequest(): void {
    document.dispatchEvent(new Event('restartServEvt'));
}

export function dispatchServerPoweroffRequest(): void {
    document.dispatchEvent(new Event('poweroffServEvt'));
}

export function dispatchServerPullTimerStatusChange(enable: boolean): void {
    document.dispatchEvent(new CustomEvent('pullTimerStatusChange', {detail: {enableTimer: enable}}));
}

export function abortAllRequests(abortControllerMap: AbortCtrllrMap): void {
    for (const [_id, controller] of abortControllerMap)
        controller.abort();
}

export function reloadUI(seconds: number): void {
    setTimeout(() => window.location.reload(), seconds * 1000);
}

export function responseHasError(resp: any): boolean {
    return !!resp.emsg;
}

export function fillRegisterPanels(registersList: (Config.Register.UIParsed|Config.Combined.UIInfo)[], pinnedPanel: PinnedRegisterPanel, othersPanel: OthersRegisterPanel): void {
    for (const regInfo of registersList) {
        if (!regInfo.label)
            continue;
        else if (regInfo.pin === true)
            pinnedPanel.addRegister(regInfo);
        else
            othersPanel.addRegister(regInfo);
    }
}

export function updateRegisterPanelValues(registersDataUpdate: RegistersMapArray, pinnedPanel: PinnedRegisterPanel,
                                          othersPanel: OthersRegisterPanel, logsModal: LogsModal): void {
    for (const regData of registersDataUpdate) {
        if (!pinnedPanel.tryUpdateValue(regData[0], regData[1]) && !othersPanel.tryUpdateValue(regData[0], regData[1]))
            logsModal.writeUILog(`updateRegisterPanelValues: missing ${regData[0]}, skip`);
    }
}

export function getFetchCmd(cmd: string, abortControllerMap: AbortCtrllrMap): Promise<Response> {
    abortControllerMap.set(cmd, new AbortController());

    const asignal: AbortSignal = abortControllerMap.get(cmd)!.signal;

    return fetch(`/getcmd?scmd=${cmd}`, {
        headers: {
            "Accept": "application/json"
        },
        credentials: 'same-origin',
        signal: asignal,
        method: 'get'
    });
}

export function postFetchCmd(cmd: string, args: object, abortControllerMap: AbortCtrllrMap): Promise<Response> {
    abortControllerMap.set(cmd, new AbortController());

    const asignal: AbortSignal = abortControllerMap.get(cmd)!.signal;

    return fetch('/postcmd', {
        headers: {
            "Content-type": "application/json",
            "Accept": "application/json"
        },
        credentials: 'same-origin',
        signal: asignal,
        method: 'post',
        body: JSON.stringify(Object.assign({scmd: cmd}, args))
    });
}

export function getFormattedDateTime(full: boolean = true): App.FormattedDatetime {
    const dnow: Date = new Date();
    const ret: App.FormattedDatetime = <App.FormattedDatetime>{
        day: padDateTimeNumber(dnow.getDate()),
        month: padDateTimeNumber(dnow.getMonth() + 1),
        year: dnow.getFullYear().toString(10)
    };

    if (full) {
        ret.hour = padDateTimeNumber(dnow.getHours());
        ret.minute = padDateTimeNumber(dnow.getMinutes());
        ret.second = padDateTimeNumber(dnow.getSeconds());
    }

    return ret;
}

export function getParentElementAt(elem: HTMLElement, count: number): HTMLElement|null {
    let tmp: HTMLElement|null = elem;

    while (--count && tmp)
        tmp = tmp.parentElement;

    return tmp;
}