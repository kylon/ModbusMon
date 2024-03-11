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
import {cloneTemplate} from "../utils.ts";

export abstract class HLabel {
    protected readonly okColor: string = 'text-green-400';
    protected readonly errColor: string = 'text-red-400';
    private hvarHandle: HTMLSpanElement;

    protected constructor(label: string, defaultStatus: string, icon: string) {
        this.hvarHandle = this.appendToHeader(label, defaultStatus, icon);
    }

    protected appendToHeader(label: string, value: string, icon: string): HTMLSpanElement {
        const header: HTMLDivElement = document.querySelector<HTMLDivElement>('#header-info')!;
        const helem: HTMLParagraphElement = cloneTemplate<HTMLParagraphElement>('header-info-lbl');
        const hvar: HTMLSpanElement = helem.querySelector<HTMLSpanElement>('.hvar')!;

        hvar.textContent = value;

        helem.querySelector<HTMLElement>('i')!.classList.add(`bi-${icon}`);
        helem.querySelector<HTMLSpanElement>('.hlabel')!.textContent = label;
        hvar.classList.add('text-red-400');
        header.appendChild(helem);

        return hvar;
    }

    protected _update(condition: boolean, defaultLabel: string, okLabel: string): void {
        this.hvarHandle.classList.remove(this.okColor, this.errColor);
        this.hvarHandle.classList.add(condition ? this.okColor : this.errColor);
        this.hvarHandle.textContent = condition ? okLabel : defaultLabel;
    }

    protected setOk(): void {
        this.hvarHandle.classList.remove(this.errColor);
        this.hvarHandle.classList.add(this.okColor);
    }

    protected setText(text: string): void {
        this.hvarHandle.textContent = text;
    }
}