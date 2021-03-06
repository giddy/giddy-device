"use strict";
/*--------------------------------------------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const constants = require("../common/constants");
const deviceContext_1 = require("../deviceContext");
const Logger = require("../logger/logger");
const serialportctrl_1 = require("./serialportctrl");
class SerialMonitor {
    constructor() {
        this._serialPortCtrl = null;
        this._outputChannel = vscode.window.createOutputChannel(SerialMonitor.SERIAL_MONITOR);
        this._currentBaudRate = SerialMonitor.DEFAULT_BAUD_RATE;
        this._portsStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2);
        this._portsStatusBar.command = "arduino.selectSerialPort";
        this._portsStatusBar.tooltip = "Select Serial Port";
        this._portsStatusBar.show();
        this._openPortStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 3);
        this._openPortStatusBar.command = "arduino.openSerialMonitor";
        this._openPortStatusBar.text = `$(plug)`;
        this._openPortStatusBar.tooltip = "Open Serial Monitor";
        this._openPortStatusBar.show();
        this._baudRateStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 4);
        this._baudRateStatusBar.command = "arduino.changeBaudRate";
        this._baudRateStatusBar.tooltip = "Baud Rate";
        this._baudRateStatusBar.text = SerialMonitor.DEFAULT_BAUD_RATE.toString();
        this.updatePortListStatus(null);
    }
    static listBaudRates() {
        return [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000];
    }
    static getIntance() {
        if (SerialMonitor._serailMonitor === null) {
            SerialMonitor._serailMonitor = new SerialMonitor();
        }
        return SerialMonitor._serailMonitor;
    }
    dispose() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._serialPortCtrl && this._serialPortCtrl.isActive) {
                yield this._serialPortCtrl.stop();
            }
        });
    }
    selectSerialPort(vid, pid) {
        return __awaiter(this, void 0, void 0, function* () {
            const lists = yield serialportctrl_1.SerialPortCtrl.list();
            if (!lists.length) {
                vscode.window.showInformationMessage("No serial port is available.");
                return;
            }
            if (vid && pid) {
                const valueOfVid = parseInt(vid, 16);
                const valueOfPid = parseInt(pid, 16);
                const foundPort = lists.find((p) => {
                    // The pid and vid returned by SerialPortCtrl start with 0x prefix in Mac, but no 0x prefix in Win32.
                    // Should compare with decimal value to keep compatibility.
                    if (p.productId && p.vendorId) {
                        return parseInt(p.productId, 16) === valueOfPid && parseInt(p.vendorId, 16) === valueOfVid;
                    }
                    return false;
                });
                if (foundPort) {
                    this.updatePortListStatus(foundPort.comName);
                }
            }
            else {
                const chosen = yield vscode.window.showQuickPick(lists.map((l) => {
                    return {
                        description: l.manufacturer,
                        label: l.comName,
                    };
                }).sort((a, b) => {
                    return a.label === b.label ? 0 : (a.label > b.label ? 1 : -1);
                }), { placeHolder: "Select a serial port" });
                if (chosen && chosen.label) {
                    this.updatePortListStatus(chosen.label);
                }
            }
        });
    }
    openSerialMonitor() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._currentPort) {
                const ans = yield vscode.window.showInformationMessage("No serial port was selected, please select a serial port first", "Yes", "No");
                if (ans === "Yes") {
                    yield this.selectSerialPort(null, null);
                }
                if (!this._currentPort) {
                    return;
                }
            }
            if (this._serialPortCtrl) {
                if (this._currentPort !== this._serialPortCtrl.currentPort) {
                    yield this._serialPortCtrl.changePort(this._currentPort);
                }
                else if (this._serialPortCtrl.isActive) {
                    vscode.window.showWarningMessage(`Serial monitor is already opened for ${this._currentPort}`);
                    return;
                }
            }
            else {
                this._serialPortCtrl = new serialportctrl_1.SerialPortCtrl(this._currentPort, this._currentBaudRate, this._outputChannel);
            }
            if (!this._serialPortCtrl.currentPort) {
                Logger.traceError("openSerialMonitorError", new Error(`Failed to open serial port ${this._currentPort}`));
                return;
            }
            try {
                yield this._serialPortCtrl.open();
                this.updatePortStatus(true);
            }
            catch (error) {
                Logger.notifyUserWarning("openSerialMonitorError", error, `Failed to open serial port ${this._currentPort} due to error: + ${error.toString()}`);
            }
        });
    }
    sendMessageToSerialPort() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._serialPortCtrl && this._serialPortCtrl.isActive) {
                const text = yield vscode.window.showInputBox();
                try {
                    yield this._serialPortCtrl.sendMessage(text);
                }
                catch (error) {
                    Logger.notifyUserWarning("sendMessageToSerialPortError", error, constants.messages.FAILED_SEND_SERIALPORT);
                }
            }
            else {
                Logger.notifyUserWarning("sendMessageToSerialPortError", new Error(constants.messages.SEND_BEFORE_OPEN_SERIALPORT));
            }
        });
    }
    changeBaudRate() {
        return __awaiter(this, void 0, void 0, function* () {
            const rates = SerialMonitor.listBaudRates();
            const chosen = yield vscode.window.showQuickPick(rates.map((rate) => rate.toString()));
            if (!chosen) {
                Logger.warn("No rate is selected, keep baud rate no changed.");
                return;
            }
            if (!parseInt(chosen, 10)) {
                Logger.warn("Invalid baud rate, keep baud rate no changed.", { value: chosen });
                return;
            }
            if (!this._serialPortCtrl) {
                Logger.warn("Serial Monitor have not been started.");
                return;
            }
            const selectedRate = parseInt(chosen, 10);
            yield this._serialPortCtrl.changeBaudRate(selectedRate);
            this._currentBaudRate = selectedRate;
            this._baudRateStatusBar.text = chosen;
        });
    }
    closeSerialMonitor(port, showWarning = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._serialPortCtrl) {
                if (port && port !== this._serialPortCtrl.currentPort) {
                    // Port is not opened
                    return false;
                }
                const result = yield this._serialPortCtrl.stop();
                this.updatePortStatus(false);
                return result;
            }
            else if (!port && showWarning) {
                Logger.notifyUserWarning("closeSerialMonitorError", new Error(constants.messages.SERIAL_PORT_NOT_STARTED));
                return false;
            }
        });
    }
    updatePortListStatus(port) {
        const dc = deviceContext_1.DeviceContext.getIntance();
        if (port) {
            dc.port = port;
        }
        this._currentPort = dc.port;
        if (dc.port) {
            this._portsStatusBar.text = dc.port;
        }
        else {
            this._portsStatusBar.text = "<Select Serial Port>";
        }
    }
    updatePortStatus(isOpened) {
        if (isOpened) {
            this._openPortStatusBar.command = "arduino.closeSerialMonitor";
            this._openPortStatusBar.text = `$(x)`;
            this._openPortStatusBar.tooltip = "Close Serial Monitor";
            this._baudRateStatusBar.show();
        }
        else {
            this._openPortStatusBar.command = "arduino.openSerialMonitor";
            this._openPortStatusBar.text = `$(plug)`;
            this._openPortStatusBar.tooltip = "Open Serial Monitor";
            this._baudRateStatusBar.hide();
        }
    }
}
SerialMonitor.SERIAL_MONITOR = "Serial Monitor";
SerialMonitor.DEFAULT_BAUD_RATE = 9600;
SerialMonitor._serailMonitor = null;
exports.SerialMonitor = SerialMonitor;

//# sourceMappingURL=serialMonitor.js.map
