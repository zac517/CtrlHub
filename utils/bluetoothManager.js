class BluetoothManager {
  constructor() {
    this.config = {
      restartInterval: 2000, // 重启适配器间隔
      rssiThreshold: -80, // 信号阈值
      testMode: true, // 测试模式
      scanInterval: 2000, // 扫描间隔
      expireTime: 5000, // 设备保留时间
      updateInterval: 1000, // 设备列表更新间隔
    };

    // 使用 Set 管理回调
    this.adapterChangeListeners = new Set();
    this.deviceChangeListeners = new Set();
    this.connectionChangeListeners = new Set();
    this.messageReceivedListeners = new Set();
    this.onAdapterRecoveryListeners = new Set();

    this.adapterState = { available: false, discovering: false };
    this.realRestartInterval = 2000;
    this.shouldRetryOpen = false,

    this.devices = [];
    this.deviceMap = new Map();
    this.updateTimer = null;

    this.connectedDevices = new Map();
  }

  /**初始化蓝牙模块 */ 
  async initBluetooth(options = {}) {
    if (this.config.testMode) console.log('initBluetooth');
    this.config = { ...this.config, ...options.config };

    this._registerCallbacks(options.deviceChange, this.deviceChangeListeners);
    this._registerCallbacks(options.adapterChange, this.adapterChangeListeners);
    this._registerCallbacks(options.connectionChange, this.connectionChangeListeners);
    this._registerCallbacks(options.messageReceived, this.messageReceivedListeners);
    this._registerCallbacks(options.onAdapterRecovery, this.onAdapterRecoveryListeners);

    wx.onBluetoothAdapterStateChange(res => {
      if (this.config.testMode) console.log('adapterChange: ' + res.available + ', ' + res.discovering);
      const lastAdapterState = this.adapterState;
      this.adapterState = res;
      this.adapterChangeListeners.forEach(cb => cb(res));
      if (!lastAdapterState.available && res.available) {
        if (this.config.testMode) console.log('onAdapterRecovery');
        this.onAdapterRecoveryListeners.forEach(cb => cb());
      }
    });

    this.shouldRetryOpen = true;
    this.realRestartInterval = this.config.restartInterval;
    await this._openBluetooth();
  }

  /**关闭蓝牙模块 */
  closeBluetooth() {
    if (this.config.testMode) console.log('closeBluetooth');
    this.stopDiscovery();
    wx.offBluetoothAdapterStateChange();
    wx.closeBluetoothAdapter();
  }

  /**开始扫描 */
  async startDiscovery(mode = 'continuous') {
    if (this.config.testMode) console.log('startDiscovery');
    this.deviceMap.clear();
    this.devices = [];
    if (this.adapterState?.available) {
      try {
        if (mode === 'continuous') {
          await wx.startBluetoothDevicesDiscovery({
            allowDuplicatesKey: true,
            interval: this.config.scanInterval,
          });
          this._listenDeviceFound('continuous');
          this.updateTimer = setInterval(() => this._updateDevices(), this.config.updateInterval);
        } else if (mode === 'fast') {
          await wx.startBluetoothDevicesDiscovery({
            allowDuplicatesKey: true,
            powerLevel: 'high',
          });
          this._listenDeviceFound('fast');
        }
      } catch (err) {
        console.error('startDiscovery failed:', err);
      }
    }
  }

  /**快速扫描 */
  async fastDiscovery(duration = 1000) {
    if (this.config.testMode) console.log('fastDiscovery');
    await this.startDiscovery('fast');
    await new Promise(resolve => setTimeout(resolve, duration));
    this.stopDiscovery();
    return Array.from(this.deviceMap.values());
  }

  /**停止扫描 */
  async stopDiscovery() {
    if (this.config.testMode) console.log('stopDiscovery');
    await wx.stopBluetoothDevicesDiscovery();
    wx.offBluetoothDeviceFound();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**注册回调，支持列表或单个函数*/
  _registerCallbacks(callbacks, listenerSet) {
    if (Array.isArray(callbacks)) {
      callbacks.forEach(cb => {
        if (typeof cb === 'function') listenerSet.add(cb);
      });
    } else if (typeof callbacks === 'function') {
      listenerSet.add(callbacks);
    }
  }

  /**开启蓝牙适配器*/
  async _openBluetooth() {
    if (this.config.testMode) console.log('openBluetooth');
    if (this.adapterState.available) {
      console.log("已开启？");
      return;
    }
    try {
      await wx.openBluetoothAdapter();
      const newState = { available: true, discovering: false };
      this.adapterState = newState;
      if (this.config.testMode) console.log('onAdapterRecovery');
      this.adapterChangeListeners.forEach(cb => cb(newState));
      this.onAdapterRecoveryListeners.forEach(cb => cb());
    } catch (err) {
      if (this.shouldRetryOpen) {
        setTimeout(() => this._openBluetooth(), this.realRestartInterval);
        this.realRestartInterval *= 1.5;
      }
    }
  }

  /**监听设备发现 */
  _listenDeviceFound(mode) {
    if (this.config.testMode) console.log('listenDeviceFound');
    wx.offBluetoothDeviceFound();
    wx.onBluetoothDeviceFound(res => {
      if (this.config.testMode) console.log('deviceFound');
      res.devices.forEach(device => {
        if (device.name && device.RSSI > this.config.rssiThreshold) {
          if (mode === 'continuous') {
            const enhancedDevice = { ...device, lastSeen: Date.now() };
            this.deviceMap.set(device.deviceId, enhancedDevice);
          } else if (mode === 'fast') {
            this.deviceMap.set(device.deviceId, device);
          }
        }
      });
    });
  }

  /**更新设备列表 */
  _updateDevices() {
    const now = Date.now();
    this.deviceMap.forEach((device, deviceId) => {
      if (now - device.lastSeen > this.config.expireTime) {
        this.deviceMap.delete(deviceId);
      }
    });
    this.devices = Array.from(this.deviceMap.values());
    this.deviceChangeListeners.forEach(cb => cb(this.devices));
  }

  /**连接设备并记录服务和特征值*/
  async connect(deviceId) {
    if (this.config.testMode) console.log('connect');
    if (this.connectedDevices.has(deviceId)) return true;
    try {
      await wx.createBLEConnection({ deviceId });
      this.connectedDevices.set(deviceId, { serviceData: null });
      wx.onBLEConnectionStateChange(res => {
        if (!res.connected && res.deviceId === deviceId) {
          this.connectedDevices.delete(deviceId);
          this.connectionChangeListeners.forEach(cb => cb(res));
        }
      });
      const serviceData = await this._discoverServicesAndCharacteristics(deviceId);
      this.connectedDevices.get(deviceId).serviceData = serviceData;
      return true;
    } catch (err) {
      console.error('connect failed:', err);
      throw err;
    }
  }

  /**发现服务和特征值*/
  async _discoverServicesAndCharacteristics(deviceId) {
    if (this.config.testMode) console.log('discoverServicesAndCharacteristics');
    try {
      const servicesRes = await wx.getBLEDeviceServices({ deviceId });
      const services = servicesRes.services;
      const servicePromises = services.map(service =>
        wx.getBLEDeviceCharacteristics({ deviceId, serviceId: service.uuid })
          .then(charRes => ({ serviceId: service.uuid, characteristics: charRes.characteristics }))
      );
      return await Promise.all(servicePromises);
    } catch (err) {
      console.error('discoverServicesAndCharacteristics failed:', err);
      throw err;
    }
  }

  /**发送消息*/
  async sendMessage(deviceId, message) {
    if (this.config.testMode) console.log('sendMessage');
    const device = this.connectedDevices.get(deviceId);
    if (!device) throw new Error('Device not connected');
    const serviceData = device.serviceData;
    if (!serviceData || serviceData.length === 0) throw new Error('No services found for this device');
    const service = serviceData[0];
    const writableChar = service.characteristics.find(char => char.properties.write || char.properties.writeNoResponse);
    if (!writableChar) throw new Error('No writable characteristic found');
    try {
      await wx.writeBLECharacteristicValue({
        deviceId,
        serviceId: service.serviceId,
        characteristicId: writableChar.uuid,
        value: this._stringToBuffer(message),
      });
    } catch (err) {
      console.error('sendMessage failed:', err);
      throw err;
    }
  }

  /**启用消息接收通知*/
  onMessageReceived(deviceId) {
    if (this.config.testMode) console.log('onMessageReceived');
    wx.onBLECharacteristicValueChange(res => {
      if (this.config.testMode) console.log('messageReceived');
      this.messageReceivedListeners.forEach(cb => cb(res.deviceId, this.bufferToString(res.value)));
    });
    const device = this.connectedDevices.get(deviceId);
    if (device && device.serviceData && device.serviceData.length > 0) {
      const service = device.serviceData[0];
      const notifyChar = service.characteristics.find(char => char.properties.notify || char.properties.indicate);
      if (notifyChar) {
        wx.notifyBLECharacteristicValueChange({
          deviceId,
          serviceId: service.serviceId,
          characteristicId: notifyChar.uuid,
          state: true,
        });
      }
    }
  }

  /**断开连接*/
  disconnect(deviceId) {
    if (!this.connectedDevices.has(deviceId)) return;
    wx.closeBLEConnection({ deviceId });
    this.connectedDevices.delete(deviceId);
  }

  /**将字符串转化为ArrayBuffer */
  _stringToBuffer(str) {
    var array = new Uint8Array(str.length);
    for (var i = 0, l = str.length; i < l; i++) {
      array[i] = str.charCodeAt(i);
    }
    return array.buffer;
  }

  /**将ArrayBuffer转化为字符串 */
  bufferToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer))
  }
}

export default BluetoothManager;