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
import {cloneTemplate, getFetchCmd, toggleLoadingScreen} from "../utils.ts";
import {Modal as TwModal} from "tw-elements";
import {Modal} from "./Modal.ts";
import {RegisterChartSettingsModal} from "./RegisterChartSettingsModal.ts";
import {ModalSize} from "../enums/ModalSize.ts";
import ApexCharts from 'apexcharts';
import {LogsModal} from "./LogsModal.ts";

export class RegisterChartModal extends Modal {
    private abortControllerMap: AbortCtrllrMap;
    private logsMdl: LogsModal;
    private regChartSetMdl: RegisterChartSettingsModal;
    private loading: HTMLDivElement;
    private title: HTMLSpanElement;
    private reloadBtn: HTMLButtonElement;
    private chartDiv: HTMLDivElement;
    private chartTxArea: HTMLTextAreaElement;
    private chartViewBtn: HTMLButtonElement;
    private textViewBtn: HTMLButtonElement;
    private currentRegister: string;
    private twModalInstance: any;
    private chart: any;

    constructor(abortControllerMap: AbortCtrllrMap, logsModal: LogsModal, regChartSettModal: RegisterChartSettingsModal) {
        super(<ModalConfig>{
            id: 'reg-chart',
            size: ModalSize.Fullscreen,
            title: '',
            titleIcon: 'bar-chart-fill',
            body: cloneTemplate<HTMLDivElement>('modal-regchart-body'),
            footer: cloneTemplate<HTMLDivElement>('modal-regchart-footer'),
            hasLoading: true
        });

        this.twModalInstance = TwModal.getOrCreateInstance(this.modalHandle);
        this.abortControllerMap = abortControllerMap;
        this.logsMdl = logsModal;
        this.regChartSetMdl = regChartSettModal;
        this.loading = this.modalHandle.querySelector<HTMLDivElement>('.loadscr')!;
        this.title = this.modalHandle.querySelector<HTMLSpanElement>('.mtitle-tx')!;
        this.reloadBtn = this.modalHandle.querySelector<HTMLButtonElement>('#upd-rchart')!;
        this.chartDiv = this.modalHandle.querySelector<HTMLDivElement>('#chart')!;
        this.chartTxArea = this.modalHandle.querySelector<HTMLTextAreaElement>('#chart-tx')!;
        this.chartViewBtn = this.modalHandle.querySelector<HTMLButtonElement>('#rchart-chart')!;
        this.textViewBtn = this.modalHandle.querySelector<HTMLButtonElement>('#rchart-tx')!
        this.currentRegister = '';
        this.chart = null;

        this.reloadBtn.addEventListener('click', this.reloadChart.bind(this));
        this.textViewBtn.addEventListener('click', this.setTextViewTabActive.bind(this));
        this.chartViewBtn.addEventListener('click', this.setChartViewTabActive.bind(this));
    }

    private toggleUIState(enable: boolean): void {
        this.chartViewBtn.disabled = !enable;
        this.textViewBtn.disabled = !enable;
        this.reloadBtn.disabled = !enable;
    }

    private setTextViewTabActive(): void {
        toggleLoadingScreen(this.loading, true);
        this.toggleUIState(false);
        this.chartDiv.classList.add('hidden');
        this.chartTxArea.classList.remove('hidden');
        this.textViewBtn.classList.remove('bg-indigo-900');
        this.textViewBtn.classList.add('bg-indigo-1000');
        this.chartViewBtn.classList.add('bg-indigo-900');
        this.chartViewBtn.classList.remove('bg-indigo-1000');
        this.fetchChart();
    }

    private setChartViewTabActive(): void {
        toggleLoadingScreen(this.loading, true);
        this.toggleUIState(false);
        this.chartTxArea.classList.add('hidden');
        this.chartDiv.classList.remove('hidden');
        this.chartViewBtn.classList.remove('bg-indigo-900');
        this.chartViewBtn.classList.add('bg-indigo-1000');
        this.textViewBtn.classList.add('bg-indigo-900');
        this.textViewBtn.classList.remove('bg-indigo-1000');
        this.fetchChart();
    }

    private setChartView(dbData: DatabaseWorker.parsedDBData): void {
        this.initChart().then(() => {
            return this.chart.updateOptions({
                series: [{
                    data: dbData.vals
                }],
                xaxis: {
                    categories: dbData.dtimes
                },
            });
        }).then((): void => {
            toggleLoadingScreen(this.loading, false);
            this.toggleUIState(true);
        });
    }

    private setTextView(dbData: DatabaseWorker.parsedDBData): void {
        let hist: string = '';

        for (let i: number = 0,l: number = dbData.vals.length; i<l; ++i)
            hist += `[${dbData.dtimes[i]}]  ${dbData.vals[i]}\n`;

        this.chartTxArea.value = hist;

        toggleLoadingScreen(this.loading, false);
        this.toggleUIState(true);
    }

    private fetchChart(): void {
        const startTm: string = this.regChartSetMdl.getStartTime();
        const endTm: string = this.regChartSetMdl.getEndTime();

        getFetchCmd(`getregchart&reg=${this.currentRegister}&stt=${startTm}&ent=${endTm}`, this.abortControllerMap).then(res => res.json()).then((data: DatabaseWorker.parsedDBData): void => {
            if (this.chartTxArea.classList.contains('hidden'))
                this.setChartView(data);
            else
                this.setTextView(data);

        }).catch((e: any): void => {
            toggleLoadingScreen(this.loading, false);
            this.toggleUIState(true);
            this.logsMdl.writeUILog(`fetchChart: ${e?.message}`);
        });
    }

    private initChart(): Promise<void> {
        if (this.chart !== null)
            return Promise.resolve();

        this.chart = new ApexCharts(this.chartDiv, {
            series: [{
                name: '',
                data: []
            }],
            chart: {
                type: 'area',
                stacked: false,
                height: '100%',
                background: "#111E39",
                foreColor: "#fff",
                zoom: {
                    type: 'x',
                    enabled: true,
                    autoScaleYaxis: true
                },
                toolbar: {
                    autoSelected: 'zoom',
                    tools: {
                        download: false,
                    }
                }
            },
            colors: ['#1E1B4B'],
            stroke: {
                width: 2
            },
            dataLabels: {
                enabled: false
            },
            grid: {
                clipMarkers: false,
                yaxis: {
                    lines: {
                        show: false
                    }
                }
            },
            markers: {
                size: 4,
                colors: '#111E39',
                strokeColors: '#4338C8',
                hover: {
                    size: 8
                }
            },
            fill: {
                type: 'solid',
                colors: '#4E47E3',
                opacity: 1.0
            },
            xaxis: {
                categories: []
            },
        });

        return this.chart.render();
    }

    private reloadChart(): void {
        if (this.currentRegister === '' || this.reloadBtn.disabled)
            return;

        toggleLoadingScreen(this.loading, true);
        this.toggleUIState(false);
        this.fetchChart();
    }

    public showChart(register: string, modalTitle: string): void {
        toggleLoadingScreen(this.loading, true);
        this.toggleUIState(false);

        this.title.textContent = modalTitle;
        this.currentRegister = register;

        this.fetchChart();
        this.twModalInstance.show();
    }
}