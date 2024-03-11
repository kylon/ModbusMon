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
declare namespace App {
    interface NoReturnData {
        emsg: string;
    }

    interface UIData {
        inverter: string;
        host: string;
        port: number;
        isValidConn: boolean;
        registerList: (Config.Register.UIParsed|Config.Combined.UIInfo)[];
        uiRegisterList: [string, string][];
        pullTimer: number;
        confStamp: number;
        confList: string[];
    }

    interface ServerData {
        isValidConnection: boolean;
        addr: string;
        port: number;
        inverter: string;
        confStamp: number;
        regsData: RegistersMapArray;
    }

    interface ServerLogs {
        log: string;
    }

    interface RefreshedRegisterValue {
        value: RegisterValue;
    }

    interface ConfigSting {
        str: string;
    }

    interface FormattedDatetime {
        day: string;
        month: string;
        year: string;
        hour?: string;
        minute?: string;
        second?: string;
    }

    interface RegisterOrderData {
        id: string;
        pos: number;
    }

    interface RegisterOrderDataMap {
        pinned: {[key: string]: number};
        registers: {[key: string]: number};
    }
}