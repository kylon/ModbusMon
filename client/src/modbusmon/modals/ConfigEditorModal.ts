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
import ace from 'ace-builds';
import aceModeWorkerYamlUrl from 'ace-builds/src-noconflict/worker-yaml?url';
import {
    cloneTemplate, dispatchAppReloadRequest,
    dispatchServerPullTimerStatusChange,
    getFetchCmd, hasProp,
    postFetchCmd, responseHasError,
    toggleLoadingScreen
} from "../utils.ts";
import {ModalSize} from "../enums/ModalSize.ts";
import {Modal} from "./Modal.ts";
import {LogsModal} from "./LogsModal.ts";
import {ToastNotification} from "../ToastNotification.ts";

export class ConfigEditorModal extends Modal {
    private readonly toastTitle: string = 'Edit configuration';
    private abortControllerMap: AbortCtrllrMap;
    private toastNotification: ToastNotification;
    private configSelect: HTMLSelectElement;
    private logsMdl: LogsModal;
    private loading: HTMLDivElement;
    private dirtyBadge: DOMTokenList;
    private reloadBtn: HTMLButtonElement;
    private saveBtn: HTMLButtonElement;
    private isDirty: boolean;
    private oldSelectVal: string;
    private editor: any;

    constructor(abortControllerMap: AbortCtrllrMap, logsModal: LogsModal, toastNotif: ToastNotification) {
        super(<ModalConfig>{
            id: 'configedit',
            size: ModalSize.Fullscreen,
            title: 'Edit configuration',
            titleIcon: 'pencil-fill',
            body: cloneTemplate<HTMLDivElement>('modal-configedit-body'),
            footer: cloneTemplate<HTMLDivElement>('modal-configedit-footer'),
            hasLoading: true
        });

        this.abortControllerMap = abortControllerMap;
        this.logsMdl = logsModal;
        this.toastNotification = toastNotif;
        this.loading = this.modalHandle.querySelector<HTMLDivElement>('.loadscr')!;
        this.dirtyBadge = this.modalHandle.querySelector<HTMLSpanElement>('#conf-dirtyb')!.classList;
        this.reloadBtn = this.modalHandle.querySelector<HTMLButtonElement>('#cfgedit-rld')!;
        this.saveBtn = this.modalHandle.querySelector<HTMLButtonElement>('#cfgedit-save')!;
        this.configSelect = this.modalHandle.querySelector<HTMLSelectElement>('#conf-edit-sel')!;
        this.oldSelectVal = '';
        this.isDirty = false;
        this.editor = null;

        this.modalHandle.addEventListener('show.te.modal', this.show.bind(this));
        this.reloadBtn.addEventListener('click', this.reloadConfig.bind(this));
        this.saveBtn.addEventListener('click', this.saveConfig.bind(this));
        this.configSelect.addEventListener('change', this.selectConfig.bind(this));
    }

    private toggleUIState(enable: boolean): void {
        this.configSelect.disabled = !enable;
        this.saveBtn.disabled = !enable;
    }

    private setDirty(): void {
        this.isDirty = true;
        this.dirtyBadge.remove('hidden');
    }

    private unsetDirty(): void {
        this.isDirty = false;
        this.dirtyBadge.add('hidden');
    }

    private confirmUnsavedChanges(): boolean {
        if (!this.isDirty)
            return true;

        const res: boolean = confirm('You have unsaved changes!\nIf you proceed, you will lose your changes!');

        if (res)
            this.unsetDirty();

        return res;
    }

    private show(): void {
        if (this.isDirty)
            return;

        this.toggleUIState(false);
        toggleLoadingScreen(this.loading, true);
        this.initEditor();
        this.fetchConfig();
    }

    private reloadConfig(): void {
        if (!this.confirmUnsavedChanges()) {
            this.editor.focus();
            return;
        }

        this.toggleUIState(false);
        toggleLoadingScreen(this.loading, true);
        this.fetchConfig();
    }

    private selectConfig(): void {
        if (!this.confirmUnsavedChanges()) {
            this.configSelect.value = this.oldSelectVal;
            this.editor.focus();
            return;
        }

        this.toggleUIState(false);
        toggleLoadingScreen(this.loading, true);
        this.fetchConfig();
        this.oldSelectVal = this.configSelect.value;
    }

    private saveConfig(): void {
        if (this.saveBtn.disabled)
            return;

        this.toggleUIState(false);
        toggleLoadingScreen(this.loading, true);
        dispatchServerPullTimerStatusChange(false);

        postFetchCmd('writecfg', {
            cfg: this.configSelect.value,
            cfgStr: this.editor.getValue()

        }, this.abortControllerMap).then(res => res.json()).then((data: App.NoReturnData): void => {
            if (responseHasError(data)) {
                throw new Error(data.emsg);

            } else {
                this.unsetDirty();
                this.toastNotification.show(this.toastTitle, 'Success, reloading...');
                dispatchAppReloadRequest();
            }
        }).catch((e: any): void => {
            dispatchServerPullTimerStatusChange(true);
            this.logsMdl.writeUILog(`configEditSaveConfiguration: ${e?.message}`);
            this.toastNotification.show(this.toastTitle, 'failed');

        }).finally((): void => {
            toggleLoadingScreen(this.loading, false);
            this.toggleUIState(true);
        });
    }

    private fetchConfig(): void {
        const selected: string = this.configSelect.value;

        getFetchCmd(`cfgstr&cfg=${selected}`, this.abortControllerMap).then(res => res.json()).then((data: App.ConfigSting): void => {
            const hasStr: boolean = hasProp(data, 'str');

            this.editor.setValue(hasStr ? data.str : '');

            if (!hasStr) {
                this.logsMdl.writeUILog('initEditor: failed to get config string');
                this.toastNotification.show(this.toastTitle, 'failed');
            }
        }).catch((e: any): void => {
            this.logsMdl.writeUILog(`initEditor: ${e?.message}`);
            this.toastNotification.show(this.toastTitle, 'unable to fetch configuration file');

        }).finally((): void => {
            toggleLoadingScreen(this.loading, false);
            this.toggleUIState(true);
        });
    }

    private initEditor(): void {
        if (this.editor !== null)
            return;

        ace.config.set('useStrictCSP', true);
        ace.config.set('loadWorkerFromBlob', false);
        ace.config.setModuleUrl('ace/mode/yaml_worker', aceModeWorkerYamlUrl);

        this.editor = ace.edit(this.modalHandle.querySelector<HTMLPreElement>('#config-editor')!, {
            theme: "ace/theme/tomorrow_night_blue",
            mode: "ace/mode/yaml",
            minLines: 30,
            tabSize: 2,
            wrap: false,
            autoScrollEditorIntoView: true,
            scrollPastEnd: 0,
            copyWithEmptySelection: false,
            displayIndentGuides: true,
            useSvgGutterIcons: true,
            dragEnabled: false
        });

        this.editor.getSession().on('change', (): void => {
            if (!this.saveBtn.disabled) // dont set dirty when setvalue(), wa for acejs
                this.setDirty();
        });
    }

    public setConfigList(configList: string[]): void {
        let i: number = 0;

        while (this.configSelect.children.length)
            this.configSelect.remove(i++);

        for (const cfg of configList) {
            const opt: HTMLOptionElement = new Option(cfg, cfg);

            opt.value = cfg;
            this.configSelect.add(opt);
        }

        this.oldSelectVal = this.configSelect.value;
    }
}