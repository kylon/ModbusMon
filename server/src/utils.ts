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
import {RegisterSizeOf} from "./enums/registerSizeOf";
import {RegisterType} from "./enums/registerType";
import {RegisterSize} from "./enums/registerSize";

function padDateTimeNumber(v: number): string {
    return v.toString(10).padStart(2, '0');
}

export const Utils = Object.freeze({
    hasProp: (obj: object, prop: string): boolean => {
        return Object.hasOwn(obj, prop);
    },
    isEmptyObj: (obj: object): boolean => {
        return Object.keys(obj).length === 0;
    },
    copyObj: (src: {[index: string]:any}, dest: {[index: string]:any}, excludes: string[] = []): void => {
        for (const key in src) {
            if (excludes.includes(key))
                continue;

            dest[key] = src[key];
        }
    },
    getFormattedDateTime: (full: boolean = true, dayOffset: number = 0): App.FormattedDatetime => {
        const dnow: Date = new Date();

        if (dayOffset > 0)
            dnow.setDate(dnow.getDate() - dayOffset);

        const ret: App.FormattedDatetime = <App.FormattedDatetime>{
            day: padDateTimeNumber(dnow.getDate()),
            month: padDateTimeNumber(dnow.getMonth() + 1),
            year: dnow.getFullYear().toString(10)
        };

        if (full) {
            ret.hour = padDateTimeNumber(dnow.getHours());
            ret.minute = padDateTimeNumber(dnow.getMinutes());
            ret.second = padDateTimeNumber(dnow.getSeconds());
        }

        return ret;
    },
    getIntervalSeconds: (interval: number|string): number => {
        if (typeof interval === 'number')
            return interval;

        const len: number = interval.length;
        const time: string = interval.substring(len - 1);
        let intervalI: number = parseInt(interval.substring(0, len - 1), 10);

        if (intervalI < 4)
            intervalI = 4;

        switch (time) {
            case 'd':
                return intervalI * 86400;
            case 'h':
                return intervalI * 3600;
            case 'm':
                return intervalI * 60;
            default:
                return intervalI;
        }
    },
    getOptimizedRegisterType: (typeStr: string): RegisterType => {
        if (typeStr === 'coil')
            return RegisterType.COIL;
        else if (typeStr === 'input')
            return RegisterType.INPUT;
        else if (typeStr === 'discrete')
            return RegisterType.DISCRETE;

        return RegisterType.HOLDING;
    },
    getRegisterLength: (size: RegisterSize): number => {
        switch (size) {
            case RegisterSize.U32:
            case RegisterSize.I32:
                return 2;
            case RegisterSize.U64:
            case RegisterSize.I64:
                return 4;
            default:
                return 1;
        }
    },
    getOptimizedRegisterSize: (sizeStr: string) => {
        if (sizeStr === 'u16')
            return {size: RegisterSize.U16, sizeof: RegisterSizeOf.U16};
        else if (sizeStr === 'i16')
            return {size: RegisterSize.I16, sizeof: RegisterSizeOf.I16};
        else if (sizeStr === 'u32')
            return {size: RegisterSize.U32, sizeof: RegisterSizeOf.U32};
        else if (sizeStr === 'i32')
            return {size: RegisterSize.I32, sizeof: RegisterSizeOf.I32};
        else if (sizeStr === 'u64')
            return {size: RegisterSize.U64, sizeof: RegisterSizeOf.U64};
        else if (sizeStr === 'i64')
            return {size: RegisterSize.I64, sizeof: RegisterSizeOf.I64};
        else if (sizeStr === 'ascii')
            return {size: RegisterSize.ASCII, sizeof: RegisterSizeOf.ASCII};
        else if (sizeStr === 'bcd16')
            return {size: RegisterSize.BCD16, sizeof: RegisterSizeOf.BCD16};

        return {size: RegisterSize.U16, sizeof: 0};
    },
    readValueFromBuffer: (buf: Buffer, size: RegisterSize, off: number): RegisterValue => {
        switch (size) {
            case RegisterSize.I16:
                return buf.readInt16BE(off);
            case RegisterSize.I32:
                return buf.readInt32BE(off);
            case RegisterSize.U32:
                return buf.readUInt32BE(off);
            case RegisterSize.I64:
                return buf.readBigInt64BE(off);
            case RegisterSize.U64:
                return buf.readBigUInt64BE(off);
            case RegisterSize.ASCII: {
                const ascii: number = buf.readUInt16BE(off);
                const c1: string = String.fromCharCode(ascii >> 8);
                const c2: string = String.fromCharCode(ascii & 0x00ff);

                return `${c1}${c2}`;
            }
            case RegisterSize.BCD16: {
                const bcd: number = buf.readUInt16BE(off);
                const n1: number = bcd >> 12;
                const n2: number = (bcd >> 8) & 0x0f;
                const n3: number = (bcd >> 4) & 0x00f;
                const n4: number = bcd & 0x000f;

                return parseFloat(`${n1}${n2}.${n3}${n4}`);
            }
            default:
                return buf.readUInt16BE(off);
        }
    },
    sizeStrToBytes: (str: string): number => {
        const szOff: number = str.length - 2;
        const sz: string = str.substring(szOff);
        const isz: number = parseInt(str.substring(0, szOff));

        if (sz === 'mb')
            return isz * 1024 * 1024;

        return isz;
    },
    getRegisterInptFromPullMap: (adr: string, regClassMap: Map<string, number>, pullReqMap: Map<number, Request.Register[]>): Config.Register.InputParsed|null => {
        const rclass: number|undefined = regClassMap.get(adr);
        const iadr: number = parseInt(adr, 16);
        const classRequests: Request.Register[]|undefined = rclass ? pullReqMap.get(rclass) : undefined;
        let regInpt: Config.Register.InputParsed|null = null;

        if (rclass === undefined || isNaN(iadr) || classRequests === undefined)
            return null;

        for (const req of classRequests) {
            const reqStartAdr: number = parseInt(req.start, 16);
            const reqEndAdr: number = reqStartAdr + req.len - 1;
            const inptIdx: number = iadr - reqStartAdr;

            if (iadr > reqEndAdr)
                continue;
            else if (inptIdx < 0 || inptIdx >= req.inputs.length)
                break;

            regInpt = req.inputs[inptIdx];
            break;
        }

        return regInpt;
    }
});