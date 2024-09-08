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
import {cloneTemplate, getParentElementAt, postFetchCmd, responseHasError, toggleLoadingScreen} from "../utils.ts";
import {ModalsLogic} from "./ModalsLogic.ts";
import {Modal} from "./Modal.ts";
import {ModalSize} from "../enums/ModalSize.ts";
import {LogsModal} from "./LogsModal.ts";
import {ToastNotification} from "../ToastNotification.ts";

export class RegisterSortModal extends Modal {
    private readonly toastTitle: string = 'Register position change';
    private toastNotification: ToastNotification;
    private abortControllerMap: AbortCtrllrMap;
    private logsMdl: LogsModal;
    private registersPanelContDiv: HTMLDivElement|null;
    private pinnedPanelContDiv: HTMLDivElement|null;
    private loading: HTMLDivElement;
    private sortRegSelect: HTMLSelectElement;
    private sortPinSelect: HTMLSelectElement;
    private selectLbl: HTMLLabelElement;
    private selectedRegInPanel: string;
    private isRegistersPanel: boolean;

    constructor(abortControllerMap: AbortCtrllrMap, logsModal: LogsModal, toastNotif: ToastNotification) {
        super(<ModalConfig>{
            id: 'regsort',
            size: ModalSize.Small,
            title: 'Set register position',
            titleIcon: 'sort-numeric-up',
            body: cloneTemplate<HTMLDivElement>('modal-regsort-body'),
            hasLoading: true
        });

        this.toastNotification = toastNotif;
        this.abortControllerMap = abortControllerMap;
        this.logsMdl = logsModal;
        this.loading = this.modalHandle.querySelector<HTMLDivElement>('.loadscr')!;
        this.sortRegSelect = this.modalHandle.querySelector<HTMLSelectElement>('#regsort-reg-sel')!;
        this.sortPinSelect = this.modalHandle.querySelector<HTMLSelectElement>('#regsort-pin-sel')!;
        this.selectLbl = this.modalHandle.querySelector<HTMLLabelElement>('#panel-type')!;
        this.registersPanelContDiv = null;
        this.pinnedPanelContDiv = null;
        this.selectedRegInPanel = "-1";
        this.isRegistersPanel = false;

        this.sortRegSelect.addEventListener('change', this.onSelectChanged.bind(this));
        this.sortPinSelect.addEventListener('change', this.onSelectChanged.bind(this));
    }

    private onSelectChanged(): void {
        const selElm: HTMLSelectElement = this.isRegistersPanel ? this.sortRegSelect : this.sortPinSelect;
        const toMoveI: number = parseInt(this.selectedRegInPanel, 10);
        const selectedI: number = parseInt(selElm.value, 10);

        if (this.registersPanelContDiv === null || this.pinnedPanelContDiv === null) {
            this.logsMdl.writeUILog(`failed to set register position: panel handle is null`);
            this.toastNotification.show(this.toastTitle, 'failed');
            return;

        } else if (this.selectedRegInPanel === "-1" || this.selectedRegInPanel === selElm.value || isNaN(toMoveI) || isNaN(selectedI)) {
            this.logsMdl.writeUILog(`failed to set register position: pos=${this.selectedRegInPanel}, new_pos=${selElm.value}`);
            this.toastNotification.show(this.toastTitle, 'failed');
            return;
        }

        const panel: HTMLDivElement = this.isRegistersPanel ? this.registersPanelContDiv! : this.pinnedPanelContDiv!;
        const r1: HTMLElement = panel.removeChild<HTMLElement>(getParentElementAt(panel.querySelector<HTMLDivElement>(`[data-rpos="${this.selectedRegInPanel}"]`)!, 6)!);
        const newOrder: App.RegisterOrderData[] = [];
        let panelChildren: HTMLCollection;

        if (toMoveI < selectedI)
            getParentElementAt(panel.querySelector<HTMLDivElement>(`[data-rpos="${selElm.value}"]`)!, 6)!.after(r1);
        else
            panel.insertBefore(r1, getParentElementAt(panel.querySelector<HTMLDivElement>(`[data-rpos="${selElm.value}"]`)!, 6));

        panelChildren = panel.children;
        for (let i=0,l=panel.childElementCount; i<l; ++i) {
            const sortBtn: HTMLElement = panelChildren[i].querySelector<HTMLElement>('[data-rpos]')!;
            const adr: string = panelChildren[i].getAttribute('data-reg')!;
            const pos: number = i + 1;

            sortBtn.setAttribute('data-rpos', pos.toString(10));
            sortBtn.textContent = pos.toString(10).padStart(2, '0');
            newOrder.push({id: adr, pos: pos});
        }

        toggleLoadingScreen(this.loading, true);
        this.saveRegistersOrder(newOrder, this.isRegistersPanel ? 'r' : 'p');
    }

    private saveRegistersOrder(newOrder: App.RegisterOrderData[], type: string): void {
        postFetchCmd('writeregsort', {
            order: newOrder,
            type: type
        }, this.abortControllerMap).then(res => res.json()).then((data: App.NoReturnData): void => {
            if (responseHasError(data))
                throw new Error(data.emsg);

            this.toastNotification.show(this.toastTitle, 'Saved');

        }).catch((e: any): void => {
            this.logsMdl.writeUILog(`saveRegistersOrder: ${e?.message}`);
            this.toastNotification.show(this.toastTitle, 'failed');

        }).finally((): void => {
            toggleLoadingScreen(this.loading, false);
            ModalsLogic.hide(this.modalHandle);
        });
    }

    private setSelectOptions(count: number, selectElm: HTMLSelectElement): void {
        for (let i=1; i<=count; ++i) {
            const opt: HTMLOptionElement = document.createElement('option');
            const pos: string = i.toString(10);

            opt.value = pos;
            opt.text = pos;

            selectElm.add(opt);
        }
    }

    public updateModal(): void {
        this.pinnedPanelContDiv = document.querySelector<HTMLDivElement>('#rpanel-Pinned')!.querySelector<HTMLDivElement>('.rp-cont')!;
        this.registersPanelContDiv = document.querySelector<HTMLDivElement>('#rpanel-Registers')!.querySelector<HTMLDivElement>('.rp-cont')!;

        this.setSelectOptions(this.registersPanelContDiv.childElementCount, this.sortRegSelect);
        this.setSelectOptions(this.pinnedPanelContDiv.childElementCount, this.sortPinSelect);
    }

    public showModal(regPos: string, panel: string): void {
        if (panel === "registers") {
            this.sortPinSelect.classList.add('hidden');
            this.sortRegSelect.classList.remove('hidden');

            this.selectLbl.textContent = 'Registers panel';
            this.sortRegSelect.value = regPos;
            this.isRegistersPanel = true;

        } else {
            this.sortRegSelect.classList.add('hidden');
            this.sortPinSelect.classList.remove('hidden');

            this.selectLbl.textContent = 'Pinned panel';
            this.sortPinSelect.value = regPos;
            this.isRegistersPanel = false;
        }

        this.selectedRegInPanel = regPos;
        ModalsLogic.show(this.modalHandle);
    }
}