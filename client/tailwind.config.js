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
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'z-1055',
    'z-1056',
    'animate-spin'
  ],
  theme: {
    safelist: [
      'slide-right_1s_ease-in-out',
      'slide-left_1s_ease-in-out'
    ],
    extend: {
      colors: {
        'indigo-1000': 'rgb(17 24 39)',
        'indigo-960': 'rgb(17, 30, 57)',
        'blue-960': 'rgb(32, 30, 100)'
      },
      screens: {
        '3xl': '2560px', // 2k,qhd
        '4xl': '3840px' // 4k,uhd
      },
      maxHeight: {
        'rpcont-vh': 'calc(100vh - 4rem - 48px)'
      },
      boxShadow: {
        'full-box': '0 0px 25px 9px rgba(0, 0, 0, 0.25)'
      },
      zIndex: {
        '1055': '1055',
        '1056': '1056'
      }
    },
  },
  darkMode: "class"
}