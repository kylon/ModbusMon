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
import {defineConfig} from 'vite';

const noncePlugin = (): any => {
  return {
    name: 'nonce',
    enforce: 'post',
    transformIndexHtml(html: string): string {
      return (html.replace(
                /(<script[^<>]*['"]*src['"]*=['"]*([^ '"]+)['"]*[^<>]*)>(<\/script>)/g, '$1 nonce="<%= nonce %>">$3'
            ).replace(
                /(<link[^<>]*['"]*rel['"]*=['"]*stylesheet['"]*[^<>]+['"]*href['"]*=['"]([^^ '"]+)['"][^<>]*)>/g, '$1 nonce="<%= nonce %>">'
            ));
    }
  }
}

const ejsIndexPlugin = (): any => {
  return {
    name: 'ejsIndex',
    enforce: 'post',
    generateBundle(options, bundle): void {
      const indexHtml = bundle['index.html'];

      indexHtml.fileName = 'index.ejs';
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: 'es2019',
    sourcemap: false,
    cssCodeSplit: false,
    outDir: '../dist/client'
  },
  plugins: [
      noncePlugin(),
      ejsIndexPlugin()
  ],
})