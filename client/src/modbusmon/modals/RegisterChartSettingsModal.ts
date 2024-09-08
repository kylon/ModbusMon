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
import {Modal} from "./Modal.ts";
import {ModalSize} from "../enums/ModalSize.ts";
import {cloneTemplate} from "../utils.ts";

export class RegisterChartSettingsModal extends Modal {
    private startTimeInpt: HTMLInputElement;
    private endTimeInpt: HTMLInputElement;
    private clearTimeIntervalBtn: HTMLButtonElement;

    constructor() {
        super(<ModalConfig>{
            id: 'regchart-sett',
            size: ModalSize.Default,
            title: 'Chart settings',
            titleIcon: 'gear-fill',
            body: cloneTemplate<HTMLDivElement>('modal-regchart-sett-body'),
            footer: cloneTemplate<HTMLDivElement>('modal-regchart-sett-footer'),
            hasLoading: false,
            zindex: 1056
        });

        this.startTimeInpt = this.modalHandle.querySelector<HTMLInputElement>('#chart-starttm')!;
        this.endTimeInpt = this.modalHandle.querySelector<HTMLInputElement>('#chart-endtm')!;
        this.clearTimeIntervalBtn = this.modalHandle.querySelector<HTMLButtonElement>('#rst-chartintv')!;

        this.clearTimeIntervalBtn.addEventListener('click', this.onResetIntervalBtnClick.bind(this));
    }

    private onResetIntervalBtnClick(): void {
        this.startTimeInpt.value = '';
        this.endTimeInpt.value = '';
    }

    public getStartTime(): string {
        return this.startTimeInpt.value;
    }

    public getEndTime(): string {
        return this.endTimeInpt.value;
    }
}