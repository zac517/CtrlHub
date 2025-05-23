class BLEManager {
  constructor() {
    this.listeners = new Set();

    this.state = false;
    this.foundDevices = new Map();
    this.connectedDevices = new Map();

    this.config = {
      discovery: {
        scanInterval: 2000,
        rssiThreshold: -80,
      },
      connect: {
        maxTryTime: 5000,
      }
    };

    this.init();
  }

  /** 初始化函数 */
  async init() {
    try {
      await wx.openBluetoothAdapter({
        mode: "central"
      });
      this.state = true;
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(this.state);
      })
    } catch (err) { }

    wx.onBluetoothAdapterStateChange(res => {
      this.state = res.available;
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(this.state);
      })
    });

    wx.onBluetoothDeviceFound(res => {
      res.devices.forEach(device => {
        if (device.name && device.RSSI > this.config.discovery.rssiThreshold) this.foundDevices.set(device.deviceId, device);
      });
      this.listeners.forEach(listener => {
        if (listener.onDeviceChange) listener.onDeviceChange(Array.from(this.foundDevices.values()));
      })
      this.foundDevices.clear();
    });

    wx.onBLEConnectionStateChange(res => {
      if (!res.connected) this.connectedDevices.delete(res.deviceId);
      this.listeners.forEach(listener => {
        if (listener.onConnectionChange) listener.onConnectionChange(res.deviceId, res.connected);
      })
    });

    wx.onBLECharacteristicValueChange(res => {
      this.listeners.forEach(listener => {
        if (listener.onMessageReceived) listener.onMessageReceived(res.deviceId, this._bufferToString(res.value));
      })
    });
  }

  /** 开启扫描 */
  async startDiscovery(config) {
    this.config.discovery = {
      ...this.config.discovery,
      ...config
    };
    await wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      interval: this.config.discovery.scanInterval,
      powerLevel: 'medium',
    });
  }

  /** 关闭扫描 */
  async stopDiscovery() {
    await wx.stopBluetoothDevicesDiscovery();
  }

  /** 连接设备并记录服务和特征值 */
  async connect(deviceId, config) {
    this.config.connect = {
      ...this.config.connect,
      ...config
    };

    await Promise.race([
      (async () => {
        await wx.createBLEConnection({
          deviceId
        });
        const serviceData = await this._findServsAndChars(deviceId);
        this.connectedDevices.set(deviceId, {
          serviceData
        });
        await this._setMessageReceiving(deviceId, true);
      })(),
      (async () => {
        await new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("BLE 连接设备超时"));
          }, this.config.connect.maxTryTime);
        });
      })()
    ]);
  }

  /** 发现服务和特征值 */
  async _findServsAndChars(deviceId) {
    const servicesRes = await wx.getBLEDeviceServices({
      deviceId
    });
    const services = servicesRes.services;
    const servicePromises = services.map(async service => {
      const charRes = await wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId: service.uuid
      });
      return {
        serviceId: service.uuid,
        characteristics: charRes.characteristics
      };
    });
    return await Promise.all(servicePromises);
  }

  /** 发送消息 */
  async sendMessage(deviceId, message) {
    if (message.length > 20) throw new Error('消息长度超过 20 个字节');
    const device = this.connectedDevices.get(deviceId);
    const service = device.serviceData[0];
    const writableChar = service.characteristics.find(char => char.properties.write || char.properties.writeNoResponse);
    await wx.writeBLECharacteristicValue({
      deviceId,
      serviceId: service.serviceId,
      characteristicId: writableChar.uuid,
      value: this._stringToBuffer(message),
    });
  }

  /** 修改消息接收通知 */
  async _setMessageReceiving(deviceId, state) {
    const device = this.connectedDevices.get(deviceId);
    const service = device.serviceData[0];
    const notifyChar = service.characteristics.find(char => char.properties.notify || char.properties.indicate);
    await wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId: service.serviceId,
      characteristicId: notifyChar.uuid,
      state,
    });
  }

  /** 断开连接 */
  async disconnect(deviceId) {
    await this._setMessageReceiving(deviceId, false);
    await wx.closeBLEConnection({
      deviceId
    });
  }

  /** 将字符串转化为ArrayBuffer */
  _stringToBuffer(str) {
    var array = new Uint8Array(str.length);
    for (var i = 0, l = str.length; i < l; i++) array[i] = str.charCodeAt(i);
    return array.buffer;
  }

  /** 将ArrayBuffer转化为字符串 */
  _bufferToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer))
  }
}

export default new BLEManager();