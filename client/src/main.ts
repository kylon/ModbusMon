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
import './style.css'
import {initTE, Toast, Datetimepicker} from "tw-elements";
import {
    abortAllRequests,
    fillRegisterPanels,
    getFetchCmd,
    reloadUI,
    toggleLoadingScreen,
    updateRegisterPanelValues
} from "./modbusmon/utils.ts";
import {HDateTimeLabel} from "./modbusmon/headerLabels/HDateTimeLabel.ts";
import {HIPLabel} from "./modbusmon/headerLabels/HIPLabel.ts";
import {HConfigSyncLabel} from "./modbusmon/headerLabels/HConfigSyncLabel.ts";
import {HConnectionLabel} from "./modbusmon/headerLabels/HConnectionLabel.ts";
import {ConfigEditorModal} from "./modbusmon/modals/ConfigEditorModal.ts";
import {LogsModal} from "./modbusmon/modals/LogsModal.ts";
import {MenuModal} from "./modbusmon/modals/MenuModal.ts";
import {PinnedRegisterPanel} from "./modbusmon/registerPanels/PinnedRegisterPanel.ts";
import {OthersRegisterPanel} from "./modbusmon/registerPanels/OthersRegisterPanel.ts";
import {ToastNotification} from "./modbusmon/ToastNotification.ts";
import {RegisterChartModal} from "./modbusmon/modals/RegisterChartModal.ts";
import {RegisterChartSettingsModal} from "./modbusmon/modals/RegisterChartSettingsModal.ts";
import {PowerModal} from "./modbusmon/modals/PowerModal.ts";
import {RegisterSortModal} from "./modbusmon/modals/RegisterSortModal.ts";
import {InverterUI} from "./modbusmon/InverterUI.ts";
import {ModalsLogic} from "./modbusmon/modals/ModalsLogic.ts";

const abortControllerMap: AbortCtrllrMap = new Map();
let toastNotification: ToastNotification;
let appLoadingDiv: HTMLDivElement;
let hIPLbl: HIPLabel;
let hConnectionLbl: HConnectionLabel;
let hConfigLbl: HConfigSyncLabel;
let logsMdl: LogsModal;
let confEditMdl: ConfigEditorModal;
let regChartMdl: RegisterChartModal;
let regChartSettingsMdl: RegisterChartSettingsModal;
let pinnedPanel: PinnedRegisterPanel;
let othersPanel: OthersRegisterPanel;
let regSortMdl: RegisterSortModal;
let inverterUI: InverterUI;
let serverPullTimeout: number;
let serverPullTimerHandle: NodeJS.Timeout;

function serverPullData(): void {
    if (serverPullTimeout === 0)
        return;

    getFetchCmd('pullserv', abortControllerMap).then(res => res.json()).then((data: App.ServerData): void => {
        hConnectionLbl.update(data.isValidConnection);
        hIPLbl.update(data.addr, data.port);
        hConfigLbl.update(data.confStamp);
        updateRegisterPanelValues(data.regsData, pinnedPanel, othersPanel, logsMdl);
        inverterUI.update();

    }).catch((e: any): void => {
        logsMdl.writeUILog(`serverPullData: ${e?.message}`);
        hConnectionLbl.update(false);
        toastNotification.show('Server pull', 'failed');

    }).finally((): void => {
        startPullTimer();
    });
}

function startPullTimer(): void {
    serverPullTimerHandle = setTimeout(serverPullData, serverPullTimeout);
}

function startApp(): void {
    getFetchCmd('uidata', abortControllerMap).then(res => res.json()).then((udata: App.UIData): void => {
        if (Object.keys(udata).length === 0)
            throw new Error();

        serverPullTimeout = udata.pullTimer * 1000;

        confEditMdl.setConfigList(udata.confList);
        hIPLbl.update(udata.host, udata.port);
        hConnectionLbl.update(udata.isValidConn);
        hConfigLbl.update(udata.confStamp);
        fillRegisterPanels(udata.registerList, pinnedPanel, othersPanel);
        inverterUI.setUIRegisters(udata.uiRegisterList);
        regSortMdl.updateModal();
        serverPullData();

    }).catch((e: any): void => {
        logsMdl.writeUILog(`initApp: ${e?.message}`);
        toastNotification.show('App init', 'failed to load UI');

    }).finally((): void => {
        toggleLoadingScreen(appLoadingDiv, false);
    });
}

function setupHLabels(): void {
    new HDateTimeLabel();

    hIPLbl = new HIPLabel();
    hConnectionLbl = new HConnectionLabel();
    hConfigLbl = new HConfigSyncLabel();
}

document.addEventListener('DOMContentLoaded', (): void => {
    const modalsJsLogic: ModalsLogic = new ModalsLogic();

    appLoadingDiv = document.querySelector<HTMLDivElement>('#loading-scr')!;
    toastNotification = new ToastNotification();
    logsMdl = new LogsModal(abortControllerMap);
    confEditMdl = new ConfigEditorModal(abortControllerMap, logsMdl, toastNotification);
    regChartSettingsMdl = new RegisterChartSettingsModal();
    regSortMdl = new RegisterSortModal(abortControllerMap, logsMdl, toastNotification);
    regChartMdl = new RegisterChartModal(abortControllerMap, logsMdl, regChartSettingsMdl);
    pinnedPanel = new PinnedRegisterPanel(abortControllerMap, logsMdl, regChartMdl, regSortMdl);
    othersPanel = new OthersRegisterPanel(abortControllerMap, logsMdl, regChartMdl, regSortMdl);
    inverterUI = new InverterUI();

    setupHLabels();
    new MenuModal();
    new PowerModal();
    modalsJsLogic.init();
    initTE({Toast, Datetimepicker});

    startApp();
});

document.addEventListener('reloadAppEvt', (): void => {
    abortControllerMap.get('pullserv')?.abort();
    toggleLoadingScreen(appLoadingDiv, true);
    abortAllRequests(abortControllerMap);
    reloadUI(2);
});

document.addEventListener('restartServEvt', (): void => {
    getFetchCmd('reboot', abortControllerMap).then((): void => {
        abortControllerMap.get('pullserv')?.abort();
        toggleLoadingScreen(appLoadingDiv, true);
        abortAllRequests(abortControllerMap);
        reloadUI(7);

    }).catch((e: any): void => {
        logsMdl.writeUILog(`restart server: failed: ${e?.message}`);
        toastNotification.show('restart server', 'failed');
    });
});

document.addEventListener('poweroffServEvt', (): void => {
    abortControllerMap.get('pullserv')?.abort();
    toggleLoadingScreen(appLoadingDiv, true);
    abortAllRequests(abortControllerMap);
    getFetchCmd('poweroff', abortControllerMap);
    reloadUI(5);
});

document.addEventListener('pullTimerStatusChange', (e: any): void => {
    abortControllerMap.get('pullserv')?.abort();

    if (!e.detail.enableTimer)
        clearTimeout(serverPullTimerHandle);
    else
        startPullTimer();
});