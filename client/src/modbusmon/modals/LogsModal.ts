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
import {cloneTemplate, getFetchCmd, getFormattedDateTime, toggleLoadingScreen} from "../utils.ts";
import {ModalSize} from "../enums/ModalSize.ts";
import {Modal} from "./Modal.ts";

export class LogsModal extends Modal {
    private readonly activeClass: string = 'bg-indigo-1000';
    private readonly inactiveClass: string = 'bg-indigo-900';
    private abortControllerMap: AbortCtrllrMap;
    private uiLogTabBtn: HTMLButtonElement;
    private uiLogTxArea: HTMLInputElement;
    private uiLogClearBtn: HTMLButtonElement;
    private serverLogTabBtn: HTMLButtonElement;
    private serverLogTxArea: HTMLInputElement;
    private serverLogReloadBtn: HTMLButtonElement;
    private loading: HTMLDivElement;

    constructor(abortControllerMap: AbortCtrllrMap) {
        super(<ModalConfig>{
            id: 'logs',
            size: ModalSize.XLarge,
            title: 'Logs',
            titleIcon: 'card-text',
            body: cloneTemplate<HTMLDivElement>('modal-logs-body'),
            footer: cloneTemplate<HTMLDivElement>('modal-logs-footer'),
            hasLoading: true
        });

        this.abortControllerMap = abortControllerMap;
        this.uiLogTabBtn = this.modalHandle.querySelector<HTMLButtonElement>('#showuilogs')!;
        this.serverLogTabBtn = this.modalHandle.querySelector<HTMLButtonElement>('#showsrvlogs')!;
        this.uiLogTxArea = this.modalHandle.querySelector<HTMLInputElement>('#uilogs-area')!;
        this.serverLogTxArea = this.modalHandle.querySelector<HTMLInputElement>('#srvlogs-area')!;
        this.uiLogClearBtn = this.modalHandle.querySelector<HTMLButtonElement>('#uilogs-clear')!;
        this.serverLogReloadBtn = this.modalHandle.querySelector<HTMLButtonElement>('#srvlogs-reload')!;
        this.loading = this.modalHandle.querySelector<HTMLDivElement>('.loadscr')!;

        this.uiLogTabBtn.addEventListener('click', this.setUILogTabActive.bind(this));
        this.serverLogTabBtn.addEventListener('click', this.setServerLogTabActive.bind(this));
        this.uiLogClearBtn.addEventListener('click', this.clearUILogs.bind(this));
        this.serverLogReloadBtn.addEventListener('click', this.reloadServerLogs.bind(this));
    }

    private setUILogTabActive(): void {
        this.serverLogReloadBtn.disabled = true;

        const serverBtn: DOMTokenList = this.serverLogTabBtn.classList;
        const uiBtn: DOMTokenList = this.uiLogTabBtn.classList;

        toggleLoadingScreen(this.loading, true);
        serverBtn.remove(this.activeClass);
        serverBtn.add(this.inactiveClass);
        uiBtn.add(this.activeClass);
        uiBtn.remove(this.inactiveClass);
        this.serverLogTxArea.classList.add('hidden');
        this.uiLogTxArea.classList.remove('hidden');
        this.uiLogClearBtn.classList.remove('hidden');
        this.serverLogReloadBtn.classList.add('hidden');
        toggleLoadingScreen(this.loading, false);
    }

    private setServerLogTabActive(): void {
        this.serverLogReloadBtn.disabled = true;

        const serverBtn: DOMTokenList = this.serverLogTabBtn.classList;
        const uiBtn: DOMTokenList = this.uiLogTabBtn.classList;

        toggleLoadingScreen(this.loading, true);

        uiBtn.add(this.inactiveClass);
        uiBtn.remove(this.activeClass);
        serverBtn.add(this.activeClass);
        serverBtn.remove(this.inactiveClass);
        this.uiLogTxArea.classList.add('hidden');
        this.serverLogTxArea.classList.remove('hidden');
        this.uiLogClearBtn.classList.add('hidden');
        this.serverLogReloadBtn.classList.remove('hidden');
        this.fetchServerLogs();
    }

    private clearUILogs(): void {
        this.uiLogTxArea.value = '';
    }

    private reloadServerLogs(): void {
        if (this.serverLogReloadBtn.disabled)
            return;

        this.serverLogReloadBtn.disabled = true;
        toggleLoadingScreen(this.loading, true);
        this.fetchServerLogs();
    }

    private fetchServerLogs(): void {
        getFetchCmd('srvlogs', this.abortControllerMap).then(res => res.json()).then((data: App.ServerLogs): void => {
            this.serverLogTxArea.value = data.log;

        }).catch((e: any): void => {
            this.writeUILog(`getServerLogs: ${e?.message}`);

        }).finally((): void => {
            toggleLoadingScreen(this.loading, false);
            this.serverLogReloadBtn.disabled = false;
        });
    }

    public writeUILog(msg: string): void {
        const now: App.FormattedDatetime = getFormattedDateTime(true);
        const timeStr: string = `${now.day}-${now.month}-${now.year} ${now.hour}:${now.minute}:${now.second}`;

        this.uiLogTxArea.value += `${timeStr} ${msg}\n`;
    }
}