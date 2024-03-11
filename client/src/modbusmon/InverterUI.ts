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
import {cloneTemplate} from "./utils.ts";

export class InverterUI {
    private labelsAr: InverterUIItem[];
    private pvLbl: HTMLSpanElement;
    private gridLbl: HTMLSpanElement;
    private gridhzLbl: HTMLSpanElement;
    private battLbl: HTMLSpanElement;
    private battvLbl: HTMLSpanElement;
    private loadLbl: HTMLSpanElement;
    private pvOutArrow: DOMTokenList;
    private gridInArrow: DOMTokenList;
    private gridOutArrow: DOMTokenList;
    private battInArrow: DOMTokenList;
    private battOutArrow: DOMTokenList;
    private loadOutArrow: DOMTokenList;

    constructor() {
        const mainCont: HTMLDivElement = document.querySelector<HTMLDivElement>('#main-cont')!;
        const inverterUI: HTMLDivElement = cloneTemplate<HTMLDivElement>('inveter-ui');
        let invui: HTMLDivElement;

        mainCont.insertBefore(inverterUI, mainCont.lastElementChild!);

        invui = document.querySelector<HTMLDivElement>('#invui')!;
        this.pvLbl = invui.querySelector<HTMLSpanElement>('#invui-pv')!;
        this.gridLbl = invui.querySelector<HTMLSpanElement>('#invui-grid')!;
        this.gridhzLbl = invui.querySelector<HTMLSpanElement>('#invui-gridhz')!;
        this.battLbl = invui.querySelector<HTMLSpanElement>('#invui-batt')!;
        this.battvLbl = invui.querySelector<HTMLSpanElement>('#invui-battv')!;
        this.loadLbl = invui.querySelector<HTMLSpanElement>('#invui-load')!;
        this.pvOutArrow = invui.querySelector<HTMLSpanElement>('#invui-pv-ar')!.classList;
        this.gridInArrow = invui.querySelector<HTMLSpanElement>('#invui-grid-al')!.classList;
        this.gridOutArrow = invui.querySelector<HTMLSpanElement>('#invui-grid-ar')!.classList;
        this.battInArrow = invui.querySelector<HTMLSpanElement>('#invui-batt-ar')!.classList;
        this.battOutArrow = invui.querySelector<HTMLSpanElement>('#invui-batt-al')!.classList;
        this.loadOutArrow = invui.querySelector<HTMLSpanElement>('#invui-load-ar')!.classList;
        this.labelsAr = [];
    }

    public setUIRegisters(uiRegisters: [string, string][]): void {
        for (const uireg of uiRegisters) {
            const regValLbl: HTMLSpanElement = document.querySelector<HTMLDivElement>(`[data-reg="${uireg[1]}"]`)!.querySelector<HTMLSpanElement>('.rpi-val')!;
            const uiLbl: string = uireg[0];

            if (uiLbl === 'pv') {
                this.labelsAr.push(<InverterUIItem>{
                    uiLabel: this.pvLbl,
                    regValueLabel: regValLbl,
                    outArrow: this.pvOutArrow
                });

            } else if (uiLbl === 'batt') {
                this.labelsAr.push(<InverterUIItem>{
                    uiLabel: this.battLbl,
                    regValueLabel: regValLbl,
                    inArrow: this.battInArrow,
                    outArrow: this.battOutArrow
                });

            } else if (uiLbl === 'battv') {
                this.battvLbl.parentElement!.classList.remove('hidden');
                this.labelsAr.push(<InverterUIItem>{
                    uiLabel: this.battvLbl,
                    regValueLabel: regValLbl
                });

            } else if (uiLbl === 'grid') {
                this.labelsAr.push(<InverterUIItem>{
                    uiLabel: this.gridLbl,
                    regValueLabel: regValLbl,
                    inArrow: this.gridInArrow,
                    outArrow: this.gridOutArrow
                });

            } else if (uiLbl === 'gridhz') {
                this.gridhzLbl.parentElement!.classList.remove('hidden');
                this.labelsAr.push(<InverterUIItem>{
                    uiLabel: this.gridhzLbl,
                    regValueLabel: regValLbl
                });

            } else if (uiLbl === 'load') {
                this.labelsAr.push(<InverterUIItem>{
                    uiLabel: this.loadLbl,
                    regValueLabel: regValLbl,
                    outArrow: this.loadOutArrow
                });
            }
        }
    }

    public update(): void {
        for (const itm of this.labelsAr) {
            const rvalue: string = itm.regValueLabel.textContent!;
            const currValue: string = itm.uiLabel.textContent!;

            if (rvalue === currValue)
                continue;

            const regVal: number = parseFloat(rvalue);

            itm.inArrow?.add('hidden');
            itm.outArrow?.add('hidden');
            itm.uiLabel.textContent = rvalue;

            if (regVal < 0)
                itm.inArrow?.remove('hidden');
            else if (regVal > 0)
                itm.outArrow?.remove('hidden');
        }
    }
}