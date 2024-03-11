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
import {getString} from "./UtilsFn";

export const ZcsFn: {[index: string]: any} = Object.freeze({
    inverterStatusStr: (status: number): string => {
        switch (status) {
            case 0:
                return 'Stand-by';
            case 1:
                return 'Checking parameters';
            case 2:
                return 'On Grid';
            case 3:
                return 'EPS';
            case 4:
                return 'Error';
            case 5:
                return 'Fatal error';
            case 6:
                return 'Upgrading...';
            case 7:
                return 'charging...';
            default:
                return 'Unknown';
        }
    },
    batteryProtocolStr: (protocol: number): string => {
        switch (protocol) {
            case 0:
                return 'Sofar built-in BMS';
            case 1:
                return 'Pylontech';
            case 2:
                return 'Sofar';
            case 3:
                return 'Amass';
            case 4:
                return 'LG';
            case 5:
                return 'Alpha ESS';
            case 6:
                return 'CATL';
            case 7:
                return 'Weco';
            default:
                return 'Unknwon';
        }
    },
    batteryCellTypeStr: (cellType: number): string => {
        switch (cellType) {
            case 0:
                return 'Lead-acid';
            case 1:
                return 'LiFePO4';
            case 2:
                return 'Lithium Ternary';
            case 3:
                return 'Lithium titanate';
            default:
                return 'Unknown';
        }
    },
    totalDaysOn: (days: number): number => {
        return Math.floor(days / 1440);
    },
    totalPvProduction: (regValues: RegistersDataMap): string => {
        let ret: number = 0;

        for (const [_reg, val] of regValues)
            ret += parseFloat(val as string);

        return ret.toFixed(2);
    },
    getStringValue: (regValues: RegistersDataMap): string => {
        return getString(regValues);
    },
    softwareVersion: (regValues: RegistersDataMap): string => {
        return getString(regValues).substring(1);
    }
});