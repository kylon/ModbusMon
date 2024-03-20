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
const childProc = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const cleanup = [
    'src/enums',
    'src/modbusTcp/enums'
];
const buildPath = path.join(__dirname, '../../dist/server');

function copyDir(src, dest) {
    try {
        const dir = fs.readdirSync(src, {encoding: 'utf-8'});

        if (!fs.existsSync(dest))
            fs.mkdirSync(dest);

        for (const f of dir) {
            const fsrc = path.join(src, f);
            const fdest = path.join(dest, f);
            const fst = fs.statSync(fsrc);

            if (fst.isDirectory())
                copyDir(fsrc, fdest);
            else
                fs.copyFileSync(fsrc, fdest);
        }
    } catch (e) {
        console.log(`copy dir error: ${e?.message}`);
    }
}

function rmDir(dpath) {
    fs.rmSync(dpath, {force: true, recursive: true});
}

if (fs.existsSync(buildPath))
    rmDir(buildPath);

try {
    console.log(childProc.execSync('tsc', {stdio: 'inherit'})?.toString() ?? '');

    if (fs.existsSync(buildPath))
        fs.copyFileSync(path.join(__dirname, '../package.json'), path.join(buildPath, 'package.json'));

} catch (e) {
    console.log(e?.message);
}

for (const cc of cleanup)
    rmDir(path.join(buildPath, cc));