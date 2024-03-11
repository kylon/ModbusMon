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
declare namespace Config {
    interface Base {
        inverter: string;
        host: string;
        port: number;
        fastStartup: boolean;
        hostConnectTimeout: number;
        hostRequestTimeout: number;
    }

    interface Yaml extends Base {
        registers: Register.Register[]
        combined: Combined.Combined[]
    }

    interface Parsed extends Base {
        pullRequestMap: Map<number, Request.Register[]>;
        combinedPullRequestMap: Map<string, Request.Register[]>;
        uiRegInfoList: (Register.UIParsed|Combined.UIInfo)[];
        combinedList: Combined.Parsed[];
        uiPullTimer: number;
        inverterUIRegisters: [string, string][];
    }

    namespace Register {
        interface Base {
            label: string;
            adr: string;
            interval: number;
            unit: string;
            icon: string;
            pin: boolean;
            hide: boolean;
            ui: string;
        }

        interface Register extends Base {
            input: Input;
        }

        interface Parsed extends Base {
            order: number;
            input: InputParsed;
        }

        interface UIParsed extends Base {
            order: number;
        }

        interface Input {
            type?: string;
            scale?: string|number;
            size?: string;
            fn?: string;
        }

        interface InputParsed {
            type: import('../enums/registerType').RegisterType;
            size: import('../enums/registerSize').RegisterSize;
            sizeof: import('../enums/registerSizeOf').RegisterSizeOf;
            len: number;
            scale: number;
            fn: string;
            hidden: boolean;
        }
    }

    namespace Combined {
        interface Base {
            label: string;
            unit: string;
            icon: string;
            pin: boolean;
            hide: boolean;
            ui: string;
        }

        interface Input {
            fn: string;
            scale: string|number;
            links: string[];
        }

        interface UIInfo extends Base {
            order: number;
            adr: string;
        }

        interface Combined extends Base {
            input: Input;
        }

        interface Parsed extends Base, UIInfo {
            input: InputParsed;
        }

        interface InputParsed {
            regs: RegistersDataMap;
            fn: string;
            scale: number;
            cvalue: RegisterValue;
            updateCounter: number;
        }
    }
}