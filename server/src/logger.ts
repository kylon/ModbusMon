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
import {Utils} from "./utils";
import net = require('node:net');

export class Logger {
    private readonly msgTitle: string;
    private loggerSock: net.Socket|undefined|null;
    private waitDrain: boolean;
    private tmpBuf: string[];
    private flushProm: any;
    private tryC: number;

    constructor(name: string) {
        this.loggerSock = undefined;
        this.msgTitle = name;
        this.waitDrain = false;
        this.flushProm = null;
        this.tmpBuf = [];
        this.tryC = 3;
    }

    private isEnabled(): boolean {
        return this.loggerSock !== null;
    }

    private onSocketDrain(): void {
        this.waitDrain = false;
        this.writeMsgs();
    }

    private onSocketError(err: any): void {
        if (err.code === 'ECONNREFUSED')
            return;

        console.log(`${this.msgTitle} logger error: ${err.code}, syscall: ${err.syscall}`);
    }

    private onSocketTimeout(): void {
        console.log(`${this.msgTitle} logger timeout`);
    }

    private onSocketEnd(): void {
        this.loggerSock?.destroy();
        this.loggerSock = null;
        this.tmpBuf = [];

        if (this.flushProm)
            this.flushProm();
    }

    private writeMsgs(): void {
        if (this.flushProm && this.tmpBuf.length === 0) {
            this.flushProm();
            this.flushProm = null;
        }

        while (this.tmpBuf.length && !this.waitDrain) {
            const msg: string = this.tmpBuf.shift()!;

            this.waitDrain = !this.loggerSock!.write(msg);
        }

        if (!this.waitDrain)
            this.startLogWrite();
    }

    private startLogWrite(): void {
        if (!this.isEnabled())
            return;

        setTimeout(this.writeMsgs.bind(this), 300);
    }

    public connect(): void {
        if (this.tryC < 0)
            return;

        const connection: Promise<net.Socket|null> = new Promise((res, _rej): void => {
            const sock: net.Socket = net.createConnection('\0loggersock', (): void => {
                this.send('logger connection successful');
                res(sock);
            });

            sock.on('error', this.onSocketError.bind(this));
            sock.on('timeout', this.onSocketTimeout.bind(this));
            sock.on('drain', this.onSocketDrain.bind(this));
            sock.on('end', this.onSocketEnd.bind(this));
        });
        const timer: Promise<null|undefined> = new Promise((res, _rej): void => {
            setTimeout(res, 3 * 1000, this.tryC > 0 ? undefined : null);
        });

        Promise.race([connection, timer]).then((res: net.Socket|null|undefined): void => {
            this.loggerSock = res;

            if (res === null) {
                this.tmpBuf = [];

                if (this.flushProm)
                    this.flushProm();

            } else if (res === undefined) {
                --this.tryC;
                this.connect();

            } else {
                this.startLogWrite();
            }
        });
    }

    public send(msg: string): void {
        if (!this.isEnabled())
            return;

        const now: App.FormattedDatetime = Utils.getFormattedDateTime(true);
        const fmsg: string = `${now.day}-${now.month}-${now.year} ${now.hour}:${now.minute}:${now.second} - ${this.msgTitle}: ${msg}\n`;

        this.tmpBuf.push(fmsg);
    }

    public flushLogs(): Promise<void> {
        if (!this.isEnabled())
            return Promise.resolve();

        return (new Promise((res, _rej): void => {
            this.flushProm = res;
        }));
    }
}