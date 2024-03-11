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
export const enum TCPPacketOffset {
    MBAPTransactionID = 0,
    MBAPProtocolID = 2,
    MBAPMessageLen = 4,
    MBAPUnitID = 6,
    PDUFunctionCode = 7,
    PDUStartAddress = 8,
    PDUNumberOfRegisters = 10,

    // write packet
    PDUNumberOfBytesMode = 12,
    PDUByteValues = 13
}