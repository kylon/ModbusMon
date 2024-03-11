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
import {
    cloneTemplate,
    dispatchAppReloadRequest,
    dispatchServerPoweroffRequest,
    dispatchServerRestartRequest,
} from "../utils.ts";
import {Modal} from "./Modal.ts";
import {ModalSize} from "../enums/ModalSize.ts";

export class PowerModal extends Modal {
    private reloadAppBtn: HTMLButtonElement;
    private restartServerBtn: HTMLButtonElement;
    private poweroffBtn: HTMLButtonElement;

    constructor() {
        super(<ModalConfig>{
            id: 'power',
            size: ModalSize.Default,
            title: 'Power',
            titleIcon: 'power',
            body: cloneTemplate<HTMLDivElement>('modal-power-body'),
            hasLoading: false
        });

        this.reloadAppBtn = this.modalHandle.querySelector<HTMLButtonElement>('#relapp')!;
        this.restartServerBtn = this.modalHandle.querySelector<HTMLButtonElement>('#restsrv')!;
        this.poweroffBtn = this.modalHandle.querySelector<HTMLButtonElement>('#shutsrv')!;

        this.reloadAppBtn.addEventListener('click', this.reloadApp);
        this.restartServerBtn.addEventListener('click', this.restartServer);
        this.poweroffBtn.addEventListener('click', this.poweroffServer);
    }

    private reloadApp(): void {
        dispatchAppReloadRequest();
    }

    private restartServer(): void {
        dispatchServerRestartRequest();
    }

    private poweroffServer(): void {
        dispatchServerPoweroffRequest();
    }
}