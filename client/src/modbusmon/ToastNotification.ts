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
export class ToastNotification {
    private toastElm: HTMLDivElement;
    private titleElm: HTMLParagraphElement;
    private contentElm: HTMLDivElement;
    private isShown: boolean;
    private hideTimer: NodeJS.Timeout|null;

    constructor() {
        this.toastElm = document.querySelector<HTMLDivElement>('#toast-notf')!;
        this.titleElm = this.toastElm.querySelector<HTMLParagraphElement>('#toast-title')!;
        this.contentElm = this.toastElm.querySelector<HTMLDivElement>('#toast-cont')!;
        this.isShown = false;
        this.hideTimer = null;

        this.toastElm.querySelector<HTMLButtonElement>('[data-mbmon-toast-dismiss]')!.addEventListener('click', this.hide.bind(this));
    }

    public show(title: string, msg: string): void {
        if (this.isShown)
            return;

        this.titleElm.textContent = title;
        this.contentElm.textContent = msg;
        this.toastElm.classList.remove('hidden');
        this.isShown = true;

        this.hideTimer = setTimeout(() => this.hide(), 4500);
    }

    public hide(): void {
        if (!this.isShown)
            return;

        clearTimeout(this.hideTimer!);
        this.toastElm.classList.add('hidden');
        this.isShown = false;
    }
}