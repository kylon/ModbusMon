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
import {HLabel} from "./HLabel.ts";

export class HIPLabel extends HLabel {
    private readonly defaultIP: string = 'Unknown';
    private oldIP: string;

    constructor() {
        super('IP', 'Unknown', 'ethernet');

        this.oldIP = '';
    }

    public update(addr: string, port: number): void {
        if (addr === this.oldIP)
            return;

        this._update(!!addr && !!port, this.defaultIP, `${addr}:${port}`);

        this.oldIP = addr;
    }
}