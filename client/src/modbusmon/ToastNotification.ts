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
import {Toast} from "tw-elements";

export class ToastNotification {
    private titleElm: HTMLParagraphElement;
    private contentElm: HTMLDivElement;
    private isShown: boolean;
    private instance: any;

    constructor() {
        const toast: HTMLDivElement = document.querySelector<HTMLDivElement>('#toast-notf')!;

        this.instance = Toast.getOrCreateInstance(toast);
        this.titleElm = toast.querySelector<HTMLParagraphElement>('#toast-title')!;
        this.contentElm = toast.querySelector<HTMLDivElement>('#toast-cont')!;
        this.isShown = false;

        toast.addEventListener('shown.te.toast', this.shown.bind(this));
        toast.addEventListener('hidden.te.toast', this.hidden.bind(this));
    }

    private shown(): void {
        this.isShown = true;
    }

    private hidden(): void {
        this.isShown = false;
    }

    public show(title: string, msg: string): void {
        if (this.isShown)
            return;

        this.titleElm.textContent = title;
        this.contentElm.textContent = msg;

        this.instance.show();
    }
}