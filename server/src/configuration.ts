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
import {Logger} from "./logger";
import path = require('node:path');
import fs = require('node:fs');
import yaml = require('yaml');

export const Configuration = (() => {
    const oldMTimeMsMap: Map<string, number> = new Map<string, number>();
    const pathMap: Map<string, string> = new Map<string, string>();
    const configList: string[] = ['config', 'logger', 'db', 'server', 'order'];
    let instance: Configuration.Instance|null = null;
    let logger: Logger;

    const obj: Configuration.Instance = Object.freeze({
        getConfigFilesList: (): string[] => {
            return configList;
        },
        getLastTimestamp: (name: string = 'config'): number => {
            return (oldMTimeMsMap.get(name) ?? 0);
        },
        hasChangedOnDisk: (name: string = 'config'): boolean => {
            const cfgPath: string|undefined = pathMap.get(name);
            const omtime: number|undefined = oldMTimeMsMap.get(name);

            if (cfgPath === undefined || omtime === undefined)
                return false;

            try {
                const fstat: fs.Stats = fs.statSync(cfgPath);

                oldMTimeMsMap.set(name, fstat.mtimeMs);
                return fstat.mtimeMs > omtime;

            } catch (e: any) {
                oldMTimeMsMap.set(name, 1);
                return omtime !== 1;
            }
        },
        getString: (name: string = 'config'): string => {
            try {
                const cfgPath: string|undefined = pathMap.get(name);

                if (cfgPath === undefined)
                    throw new Error('undefined path');

                return fs.readFileSync(cfgPath, 'utf-8').trim();

            } catch (e: any) {
                logger.send(`getString: failed to read config file: ${e?.message}`);
                return '';
            }
        },
        load: (name: string = 'config'): any => {
            try {
                const cfgPath: string|undefined = pathMap.get(name);

                if (cfgPath === undefined)
                    throw new Error('undefined path');

                return yaml.parse(fs.readFileSync(cfgPath, 'utf-8').trim());

            } catch (e: any) {
                logger.send(`load: failed to load config: ${e?.message}`);
                return {};
            }
        },
        loadFromStr: (configStr: string): any => {
            try {
                return yaml.parse(configStr);

            } catch (e: any) {
                logger.send(`loadFromStr: failed to parse config ${e?.message}`);
                return {};
            }
        },
        write: (config: string, name: string = 'config'): boolean => {
            try {
                const cfgPath: string|undefined = pathMap.get(name);

                if (cfgPath === undefined)
                    throw new Error('undefined path');

                fs.writeFileSync(cfgPath, config.trim());
                return true;

            } catch (e: any) {
                logger.send(`failed to write ${name}\n${e?.message}`);
                return false;
            }
        },
        writeData: (data: any, name: string = 'config'): boolean => {
            try {
                const cfgPath: string|undefined = pathMap.get(name);

                if (cfgPath === undefined)
                    throw new Error('undefined path');

                fs.writeFileSync(cfgPath, yaml.stringify(data));
                return true;

            } catch (e: any) {
                logger.send(`failed to write data ${name}\n${e?.message}`);
                return false;
            }
        }
    });

    function construct(): void {
        const basePath: string = path.join(__dirname, `../../user/cfg`);

        logger = new Logger('Configuration');

        for (const cfg of configList) {
            const cfgPath: string = path.join(basePath, `${cfg}.yaml`);

            try {
                const fstat: fs.Stats = fs.statSync(cfgPath);

                oldMTimeMsMap.set(cfg, fstat.mtimeMs);

            } catch (e: any) {
                oldMTimeMsMap.set(cfg, 0);
            }

            pathMap.set(cfg, cfgPath);
        }

        logger.connect();
        instance = obj;
    }

    return Object.freeze({
        getInstance: (): Configuration.Instance => {
            if (instance === null)
                construct();

            return instance!;
        }
    });
})();