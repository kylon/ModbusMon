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
/// <reference path="../../server/src/types/Config.d.ts" />
/// <reference path="../../server/src/types/App.d.ts" />
/// <reference path="../../server/src/types/Aliases.d.ts" />
/// <reference path="../../server/src/types/DatabaseWorker.d.ts" />

type AbortCtrllrMap = Map<string, AbortController>;

interface RegisterPanelConfig {
    label: string;
}

interface ModalConfig {
    id: string;
    size: import('./modbusmon/enums/ModalSize').ModalSize;
    title: string;
    titleIcon: string;
    body: HTMLElement;
    bodyClasses?: string[];
    footer?: HTMLElement;
    hasLoading: boolean;
    zindex?: number;
}

interface InverterUIItem {
    uiLabel: HTMLSpanElement;
    regValueLabel: HTMLSpanElement;
    inArrow?: DOMTokenList;
    outArrow?: DOMTokenList;
}