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
import {ModalSize} from "../enums/ModalSize.ts";
import {cloneTemplate} from "../utils.ts";

export abstract class Modal {
    protected modalHandle: HTMLDivElement;

    protected constructor(mconfig: ModalConfig) {
        const body: HTMLBodyElement = document.querySelector<HTMLBodyElement>('body')!;

        body.appendChild(this.generateModal(mconfig));

        this.modalHandle = body.querySelector<HTMLDivElement>(`#${mconfig.id}`)!;
    }

    private setModalSize(size: ModalSize, modal: HTMLDivElement, mcont: HTMLDivElement): void {
        const dialogRef: DOMTokenList = modal.querySelector<HTMLDivElement>('[data-mbmon-modal-dialog-ref]')!.classList;

        switch (size) {
            case ModalSize.Default:
                dialogRef.add('min-[576px]:mx-auto', 'min-[576px]:mt-7', 'min-[576px]:max-w-[500px]');
                break;
            case ModalSize.Fullscreen: {
                const titleDiv: HTMLDivElement = mcont.querySelector<HTMLDivElement>('div:first-child')!;

                dialogRef.add('min-[0px]:m-0', 'min-[0px]:h-full', 'min-[0px]:max-w-none');
                mcont.classList.add('h-full', 'min-[0px]:rounded-none', 'min-[0px]:border-0');
                titleDiv.classList.remove('rounded-t-md');
            }
                break;
            case ModalSize.Small:
                dialogRef.add('min-[576px]:mx-auto', 'min-[576px]:mt-7', 'min-[576px]:max-w-[300px]');
                break;
            case ModalSize.Large:
                dialogRef.add('min-[576px]:mx-auto', 'min-[576px]:mt-7', 'min-[576px]:max-w-[500px]', 'min-[992px]:max-w-[800px]');
                break;
            case ModalSize.XLarge:
                dialogRef.add('min-[576px]:mx-auto', 'min-[576px]:mt-7', 'min-[576px]:max-w-[500px]', 'min-[992px]:max-w-[800px]', 'min-[1200px]:max-w-[1140px]');
                break;
            default:
                break;
        }
    }

    private generateModal(config: ModalConfig): HTMLDivElement {
        const modal: HTMLDivElement = cloneTemplate<HTMLDivElement>('modal');
        const modalDiv: HTMLDivElement = modal.querySelector<HTMLDivElement>(':first-child')!;
        const title: HTMLHeadingElement = modal.querySelector<HTMLHeadingElement>('.mtitle')!;
        const cont: HTMLDivElement = modal.querySelector<HTMLDivElement>('.mcont')!;
        const mbody: HTMLDivElement = modal.querySelector<HTMLDivElement>('.mbody')!;

        if (config.hasLoading)
            mbody.appendChild(cloneTemplate<HTMLDivElement>('modal-loading'));

        if (config.zindex)
            modalDiv.classList.add(`z-${config.zindex}`);
        else
            modalDiv.classList.add('z-1055');

        modalDiv.setAttribute('id', config.id);
        title.querySelector<HTMLSpanElement>('.mtitle-tx')!.textContent = config.title;
        title.insertAdjacentHTML('afterbegin', `<i class="bi bi-${config.titleIcon}"></i>`);
        mbody.appendChild(config.body);
        this.setModalSize(config.size, modal, cont);

        if (config.static) {
            modalDiv.setAttribute('data-te-backdrop', 'static');
            modalDiv.setAttribute('data-te-keyboard', 'false');
        }

        if (config.footer !== undefined)
            cont.appendChild(config.footer);

        return modal;
    }
}