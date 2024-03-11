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

export class HConnectionLabel extends HLabel {
    private readonly defaultStatus: string = 'Disconnected';
    private oldStatus: boolean;

    constructor() {
        super('Status', 'Disconnected', 'router-fill');

        this.oldStatus = false;
    }

    public update(status: boolean): void {
        if (status === this.oldStatus)
            return;

        this._update(status, this.defaultStatus, 'Connected');

        this.oldStatus = status;
    }
}