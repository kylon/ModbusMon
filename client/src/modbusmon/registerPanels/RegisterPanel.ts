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
import {cloneTemplate, getFetchCmd} from "../utils.ts";
import {RegisterChartModal} from "../modals/RegisterChartModal.ts";
import {LogsModal} from "../modals/LogsModal.ts";
import {RegisterSortModal} from "../modals/RegisterSortModal.ts";
import DOMPurify from 'dompurify';

export abstract class RegisterPanel {
    private readonly panelType: string;
    private abortControllerMap: AbortCtrllrMap;
    private logsMdl: LogsModal;
    private regChartMdl: RegisterChartModal;
    private regSortMdl: RegisterSortModal;
    private panelLblHandle: HTMLSpanElement;
    private hasNoData: boolean;
    private regCount: number;
    private regPosIdx: number;
    protected rpiValueMap: Map<string, HTMLSpanElement>;
    protected panelHandle: HTMLDivElement;

    protected constructor(abortControllerMap: AbortCtrllrMap, logsModal: LogsModal, rconfig: RegisterPanelConfig, regChartModal: RegisterChartModal, regSortModal: RegisterSortModal) {
        const mainCont: HTMLDivElement = document.querySelector<HTMLDivElement>('#main-cont')!;
        const noRegData: HTMLDivElement = cloneTemplate<HTMLDivElement>('no-regs-data-panel-item');
        const panel: HTMLDivElement = cloneTemplate<HTMLDivElement>('registers-panel');
        const panelLbl: HTMLParagraphElement = panel.querySelector<HTMLParagraphElement>('.rp-label')!;
        const id: string = `rpanel-${rconfig.label}`;
        let panelDiv: HTMLDivElement;

        panelLbl.textContent = rconfig.label;
        panel.querySelector<HTMLDivElement>('div')!.setAttribute('id', id);
        panel.querySelector<HTMLDivElement>('.rp-cont')!.appendChild(noRegData);
        panelLbl.appendChild(document.createElement('span'));
        mainCont.appendChild(panel);

        panelDiv = mainCont.querySelector<HTMLDivElement>(`#${id}`)!;

        this.rpiValueMap = new Map<string, HTMLSpanElement>();
        this.abortControllerMap = abortControllerMap;
        this.logsMdl = logsModal;
        this.panelHandle = panelDiv.querySelector<HTMLDivElement>('.rp-cont')!;
        this.panelLblHandle = panelDiv.querySelector<HTMLSpanElement>('.rp-label')!.firstElementChild as HTMLSpanElement;
        this.panelType = rconfig.label.toLowerCase();
        this.regChartMdl = regChartModal;
        this.regSortMdl = regSortModal;
        this.hasNoData = true;
        this.regCount = 0;
        this.regPosIdx = 1;
    }

    private onPanelItemClick(e: MouseEvent, registerInfo: Config.Register.UIParsed|Config.Combined.UIInfo, title: string): void {
        const targ: HTMLElement = e.target as HTMLElement;

        if (targ.classList.contains('rpi-v-rfrsh')) {
            const curTarg: HTMLElement = e.currentTarget as HTMLElement;
            let animDivClassList: DOMTokenList = targ.classList;

            if (targ.tagName.toLowerCase() === 'i')
                animDivClassList = targ.parentElement!.classList;
            else if (!animDivClassList.contains('anim'))
                animDivClassList = targ.firstElementChild!.classList;

            if (animDivClassList.contains('animate-spin'))
                return;

            this.refreshRegisterValue(curTarg.getAttribute('data-reg')!, animDivClassList);
            animDivClassList.add('animate-spin');

        } else if (targ.classList.contains('rpi-sort')) {
            const elm: HTMLElement = targ.tagName.toLowerCase() === 'i' ? targ : targ.firstElementChild as HTMLElement;

            this.regSortMdl.showModal(elm.getAttribute('data-rpos')!, this.panelType);

        } else {
            this.regChartMdl.showChart(registerInfo.adr, title);
        }
    }

    private refreshRegisterValue(regAdr: string, elmClasses: DOMTokenList): void {
        const fcmd: string = regAdr.startsWith('comb', 0) ? 'rfrshcomb&id' : 'rfrshreg&adr';

        getFetchCmd(`${fcmd}=${regAdr}`, this.abortControllerMap).then(res => res.json()).then((ret: App.RefreshedRegisterValue): void => {
            elmClasses.remove('animate-spin');

            if (ret.value === '') {
                this.logsMdl.writeUILog(`refreshRegisterValue: failed to read register`);
                return;
            }

            this.tryUpdateValue(regAdr, ret.value);

        }).catch((e: any): void => {
            this.logsMdl.writeUILog(`refreshRegisterValue: ${e?.message}`);
            elmClasses.remove('animte-spin');
        });
    }

    public addRegister(registerInfo: Config.Register.UIParsed|Config.Combined.UIInfo): void {
        const panelItem: HTMLDivElement = cloneTemplate<HTMLDivElement>('register-panel-item');
        const container: HTMLDivElement = panelItem.querySelector<HTMLDivElement>('[role="button"]')!;
        const rlabel: HTMLSpanElement = panelItem.querySelector<HTMLSpanElement>('.rpi-lbl')!;
        const rvalue: HTMLSpanElement = panelItem.querySelector<HTMLSpanElement>('.rpi-val')!;
        const rsortBtn: HTMLElement = panelItem.querySelector<HTMLElement>('.rpi-sort')!.firstElementChild! as HTMLElement;
        const title: string = `[${registerInfo.adr}] ${registerInfo.label}`;

        if (registerInfo.icon) {
            const sanitized: string = DOMPurify.sanitize(`<i class="bi bi-${registerInfo.icon}"></i> `, {ALLOWED_TAGS: ['i']});

            rlabel.insertAdjacentHTML('beforebegin',  sanitized);
        }

        if (registerInfo.unit)
            rvalue.insertAdjacentText('afterend', ` ${registerInfo.unit}`);

        container.setAttribute('title', title);
        container.setAttribute('data-reg', registerInfo.adr);
        container.addEventListener('click', (e: MouseEvent): void => {this.onPanelItemClick(e, registerInfo, title)});

        rsortBtn.setAttribute('data-rpos', this.regPosIdx.toString(10));
        rsortBtn.textContent = this.regPosIdx.toString(10).padStart(2, '0');

        rlabel.textContent = registerInfo.label;
        rvalue.textContent = 'N/A';

        if (this.hasNoData) {
            this.hasNoData = false;
            this.panelHandle.removeChild<Element>(this.panelHandle.firstElementChild!);
        }

        this.panelHandle.appendChild(panelItem);
        this.rpiValueMap.set(registerInfo.adr, this.panelHandle.lastElementChild?.querySelector<HTMLSpanElement>('.rpi-val')!);
        this.panelLblHandle.textContent = ` [${++this.regCount}]`;
        ++this.regPosIdx;
    }

    public tryUpdateValue(regAdr: string, rvalue: string|number|bigint): boolean {
        const rpiVal: HTMLSpanElement|undefined = this.rpiValueMap.get(regAdr);

        if (rpiVal === undefined)
            return false;

        rpiVal.textContent = rvalue.toString(10);
        return true;
    }
}