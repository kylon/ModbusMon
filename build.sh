#!/bin/bash
#    modbusmon
#    Copyright (C) 2024  kylon
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
function build_client() {
  rm -R dist/client &>/dev/null
  yarn --cwd client/ build
}

function build_server() {
  rm -R dist/server &>/dev/null
  yarn --cwd server/ build
}

if [[ "$1" == "client" ]]; then
  build_client

elif [[ "$1" == "server" ]]; then
  build_server

else
  build_client
  build_server
fi