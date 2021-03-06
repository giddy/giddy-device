"use strict";
/*--------------------------------------------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
class SerialPortCtrl {
    constructor(port, baudRate, _outputChannel) {
        this._outputChannel = _outputChannel;
        this._currentSerialPort = null;
        this._currentBaudRate = baudRate;
        this._currentPort = port;
    }
    static list() {
        return new Promise((resolve, reject) => {
            SerialPortCtrl.serialport.list((e, ports) => {
                if (e) {
                    reject(e);
                }
                else {
                    resolve(ports);
                }
            });
        });
    }
    get isActive() {
        return this._currentSerialPort && this._currentSerialPort.isOpen();
    }
    get currentPort() {
        return this._currentPort;
    }
    open() {
        this._outputChannel.appendLine(`[Starting] Opening the serial port - ${this._currentPort}`);
        return new Promise((resolve, reject) => {
            if (this._currentSerialPort && this._currentSerialPort.isOpen()) {
                this._currentSerialPort.close((err) => {
                    if (err) {
                        return reject(err);
                    }
                    this._currentSerialPort = null;
                    return this.open().then(() => {
                        resolve();
                    }, (error) => {
                        reject(error);
                    });
                });
            }
            else {
                this._currentSerialPort = new SerialPortCtrl.serialport(this._currentPort, { baudRate: this._currentBaudRate });
                this._outputChannel.show();
                this._currentSerialPort.on("open", () => {
                    this._currentSerialPort.write("TestingOpen", (err) => {
                        // TODO: Fix this on the serial port lib: https://github.com/EmergingTechnologyAdvisors/node-serialport/issues/795
                        if (err && !(err.message.indexOf("Writing to COM port (GetOverlappedResult): Unknown error code 121") >= 0)) {
                            this._outputChannel.appendLine(`[Error] Failed to open the serial port - ${this._currentPort}`);
                            reject(err);
                        }
                        else {
                            this._outputChannel.appendLine(`[Info] Opened the serial port - ${this._currentPort}`);
                            resolve();
                        }
                    });
                });
                this._currentSerialPort.on("data", (_event) => {
                    this._outputChannel.append(_event.toString());
                });
                this._currentSerialPort.on("error", (_error) => {
                    this._outputChannel.appendLine("[Error]" + _error.toString());
                });
            }
        });
    }
    sendMessage(text) {
        return new Promise((resolve, reject) => {
            if (!text || !this._currentSerialPort || !this.isActive) {
                resolve();
                return;
            }
            this._currentSerialPort.write(text, (error) => {
                if (!error) {
                    resolve();
                }
                else {
                    return reject(error);
                }
            });
        });
    }
    changePort(newPort) {
        return new Promise((resolve, reject) => {
            if (newPort === this._currentPort) {
                resolve();
                return;
            }
            this._currentPort = newPort;
            if (!this._currentSerialPort || !this.isActive) {
                resolve();
                return;
            }
            this._currentSerialPort.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    this._currentSerialPort = null;
                    resolve();
                }
            });
        });
    }
    stop() {
        return new Promise((resolve, reject) => {
            if (!this._currentSerialPort || !this.isActive) {
                resolve(false);
                return;
            }
            this._currentSerialPort.close((err) => {
                if (this._outputChannel) {
                    this._outputChannel.appendLine(`[Done] Closed the serial port ${os.EOL}`);
                }
                this._currentSerialPort = null;
                if (err) {
                    reject(err);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    changeBaudRate(newRate) {
        return new Promise((resolve, reject) => {
            this._currentBaudRate = newRate;
            if (!this._currentSerialPort || !this.isActive) {
                resolve();
                return;
            }
            this._currentSerialPort.update({ baudRate: this._currentBaudRate }, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}
SerialPortCtrl.serialport = require("../../../vendor/serialport-native");
exports.SerialPortCtrl = SerialPortCtrl;

//# sourceMappingURL=serialportctrl.js.map
