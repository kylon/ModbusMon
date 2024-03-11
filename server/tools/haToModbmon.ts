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
import path = require('node:path');
import fs = require('node:fs');
import yaml = require('yaml');

function haDataTypeToSize(type: string): string {
    if (type === 'uint16')
        return 'u16';
    else if (type === 'int16')
        return 'i16';
    else if (type === 'uint32')
        return 'u32';
    else if (type === 'int32')
        return 'i32';
    else if (type === 'uint64')
        return 'u64';
    else if (type === 'int64')
        return 'i64';
    else
        return '';
}

if (process.argv.length !== 3) {
    console.log('no configuration.yaml file provided');
    process.exit(1);

} else if (!fs.existsSync(process.argv[2])) {
    console.log(`cannot find file: ${process.argv[2]}`);
    process.exit(1);
}

try {
    const config: any = {
        inverter: 'modbusMon',
        host: '127.0.0.1',
        port: 502,
        registers: []
    };
    const haConf: any = yaml.parse(fs.readFileSync(process.argv[2], 'utf-8'));
    const modbus: any = haConf.modbus.at(0);

    if (!modbus) {
        console.log('no modbus data found');
        process.exit(1);
    }

    if (modbus.hasOwnProperty('name') && modbus.name)
        config.inverter = modbus.name;

    if (modbus.hasOwnProperty('host') && modbus.host)
        config.host = modbus.host;

    if (modbus.hasOwnProperty('port') && modbus.port)
        config.port = modbus.port;

    for (const entry of modbus.sensors) {
        const reg: any = {
            label: entry.name,
            adr: '0x' + entry.address.toString(16),
            interval: entry.scan_interval
        };

        if (entry.hasOwnProperty('unit_of_measurement') && entry.unit_of_measurement)
            reg.unit = entry.unit_of_measurement;

        if (entry.hasOwnProperty('data_type') && entry.data_type) {
            const type: string = haDataTypeToSize(entry.data_type);

            if (type === '')
                console.log(`unhandled type: ${entry.data_type}`);
            else if (type !== 'u16')
                reg.input = {size: type};
        }

        if (entry.hasOwnProperty('input_type') && entry.input_type && entry.input_type !== 'holding') {
            if (!reg.hasOwnProperty('input'))
                reg.input = {};

            reg.input.type = entry.input_type;
        }

        if (entry.hasOwnProperty('scale') && entry.scale) {
            if (!reg.hasOwnProperty('input'))
                reg.input = {};

            reg.input.scale = entry.scale;
        }

        config.registers.push(reg as Config.Register.Register);
    }

    fs.writeFileSync(path.join(__dirname, '../../user/config-converted.yaml'), yaml.stringify(config));

} catch (e: any) {
    console.log(`unhandled error: ${e?.message}`);
}