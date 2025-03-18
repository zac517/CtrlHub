class BluetoothManager {
  constructor(config) {
    const deviceInfo = wx.getDeviceInfo();
    /**当前平台 */
    this.platform = deviceInfo.platform;

    if (this._checkLevels(0)) {
      this.config = {
        testMode: false,
        scanInterval: 2000,
        /**信号阈值 */
        rssiThreshold: -80,
      };
      this.config = { ...this.config, ...config };
      if (this.config.testMode) console.log('蓝牙模块初始化');

      /**任务列表 */
      this.tasks = new Set();

      this.state = { available: false, discovering: false };
      this.devices = new Map();
      this.connectedDevices = new Map();

      this.init();
    }
  }

  /**初始化函数 */
  async init() {
    if (this.config.testMode) console.log('尝试开启蓝牙适配器');
    try {
      await wx.openBluetoothAdapter();
      this.state = { available: true, discovering: false };
      this.tasks.forEach(task => {
        if (task.callbacks.onStateChange) task.callbacks.onStateChange(this.state);
      })
      if (this.config.testMode) console.log('开启蓝牙适配器成功');
    } catch (err) {
      console.log('开启蓝牙适配器失败: ' + err);
    }

    wx.onBluetoothAdapterStateChange(res => {
      if (this.config.testMode) console.log('蓝牙适配器状态变化为: ' + JSON.stringify(res));
      const lastState = this.state;
      this.state = res;
      this.tasks.forEach(task => {
        if (task.callbacks.onStateChange) task.callbacks.onStateChange(res);
      })
      if (!lastState.available && res.available) {
        if (this.config.testMode) console.log('蓝牙适配器恢复');
        this.tasks.forEach(task => {
          if (task.recover) task.recover();
        })
      }
    });

    wx.onBluetoothDeviceFound(res => {
      if (this.config.testMode) console.log('蓝牙发现设备');
      res.devices.forEach(device => {
        if (device.name && device.RSSI > this.config.rssiThreshold) {
          this.devices.set(device.deviceId, device);
        }
      });
      this.tasks.forEach(task => {
        if (task.callbacks.onDeviceChange) task.callbacks.onDeviceChange(Array.from(this.devices.values()));
      })
      this.devices.clear();
    });

    wx.onBLEConnectionStateChange(res => {
      if (this.config.testMode) console.log('蓝牙设备连接状态变化');
      if (!res.connected) this.connectedDevices.delete(res.deviceId);
      this.tasks.forEach(task => {
        if (task.callbacks.onConnectionChange) task.callbacks.onConnectionChange(res);
      })
    });

    wx.onBLECharacteristicValueChange(res => {
      if (this.config.testMode) console.log('蓝牙收到消息');
      this.tasks.forEach(task => {
        if (task.callbacks.onMessageReceived) task.callbacks.onMessageReceived(res.deviceId, this.bufferToString(res.value));
      })
    });
  }

  /**检查条件 */
  _checkLevels(level, deviceId = '') {
    if (this.platform == 'devtools') {
      console.log("当前平台为 devtools，不支持蓝牙相关功能");
      return false;
    };
    if (level == 0) return true;

    if (!this.state.available) {
      console.log("蓝牙适配器未开启");
      return false;
    };
    if (level == 1) return true;

    if (deviceId == '') {
      console.log("蓝牙 _checkLevels 方法调用有误：未提供 deviceId")
    }
    if (!this.connectedDevices.has(deviceId)) {
      console.log(`蓝牙未连接到设备 ${deviceId}`);
      return false;
    };
    if (level == 2) return true;

    const device = this.connectedDevices.get(deviceId);
    const serviceData = device.serviceData;
    if (!serviceData || serviceData.length === 0) {
      console.log(`设备 ${deviceId} 的服务 id 未找到`);
      return false;
    };
    if (level == 3) return true;

    const service = serviceData[0];
    const writableChar = service.characteristics.find(char => char.properties.write || char.properties.writeNoResponse);
    const notifyChar = service.characteristics.find(char => char.properties.notify || char.properties.indicate);
    if (!writableChar || !notifyChar) {
      console.log(`设备 ${deviceId} 未找到可用特征值`);
      return false;
    };
    if (level == 4) return true;

    return false;
  }

  /**初始化并开始任务函数 */
  begin(task) {
    if (this._checkLevels(0)) {
      this.tasks.add(task);
      if (task.setup) task.setup();
    }
  }

  /**结束任务函数 */
  finish(task) {
    if (this._checkLevels(0)) {
      if (task.end) task.end();
      this.tasks.delete(task);
    }
  }

  /**开启扫描 */
  async startDiscovery() {
    if (this._checkLevels(1)) {
      if (this.config.testMode) console.log('蓝牙开启扫描');
      try {
        await wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: true,
          interval: this.config.scanInterval,
          powerLevel: 'medium',
        });
      } catch (err) {
        console.error('蓝牙开启扫描失败:', err);
      }
    }
  }

  /**关闭扫描 */
  async stopDiscovery() {
    if (this._checkLevels(1)) {
      if (this.config.testMode) console.log('蓝牙关闭扫描');
      try {
        await wx.stopBluetoothDevicesDiscovery();
      } catch (err) {
        console.error('蓝牙关闭扫描失败:', err);
      }
    }
  }

  /**连接设备并记录服务和特征值 */
  async connect(deviceId) {
    if (this._checkLevels(1)) {
      if (this.config.testMode) console.log('蓝牙连接设备');
      try {
        await wx.createBLEConnection({ deviceId });
        this.connectedDevices.set(deviceId, { serviceData: null });
        const serviceData = await this._discoverServicesAndCharacteristics(deviceId);
        this.connectedDevices.get(deviceId).serviceData = serviceData;
        this._onMessageReceived(deviceId, true);
        return true;
      } catch (err) {
        console.error('蓝牙连接设备失败: ', err);
        throw err;
      }
    }
  }

  /**发现服务和特征值 */
  async _discoverServicesAndCharacteristics(deviceId) {
    if (this._checkLevels(2, deviceId)) {
      if (this.config.testMode) console.log('蓝牙发现服务和特征值');
      try {
        const servicesRes = await wx.getBLEDeviceServices({ deviceId });
        const services = servicesRes.services;
        const servicePromises = services.map(async service => {
          const charRes = await wx.getBLEDeviceCharacteristics({ deviceId, serviceId: service.uuid });
          return { serviceId: service.uuid, characteristics: charRes.characteristics };
        });
        return await Promise.all(servicePromises);
      } catch (err) {
        console.error('蓝牙发现服务和特征值失败: ', err);
        throw err;
      }
    }
  }

  /**发送消息 */
  async sendMessage(deviceId, message) {
    if (this._checkLevels(4, deviceId)) {
      if (this.config.testMode) console.log('蓝牙发送消息');
      const device = this.connectedDevices.get(deviceId);
      const service = device.serviceData[0];
      const writableChar = service.characteristics.find(char => char.properties.write || char.properties.writeNoResponse);
      try {
        await wx.writeBLECharacteristicValue({
          deviceId,
          serviceId: service.serviceId,
          characteristicId: writableChar.uuid,
          value: this._stringToBuffer(message),
        });
      } catch (err) {
        console.error('蓝牙发送消息失败: ', err);
        throw err;
      }
    }
  }

  /**修改消息接收通知 */
  async _onMessageReceived(deviceId, state) {
    if (this._checkLevels(4, deviceId)) {
      if (this.config.testMode) console.log('修改蓝牙消息通知');
      const device = this.connectedDevices.get(deviceId);
      const service = device.serviceData[0];
      const notifyChar = service.characteristics.find(char => char.properties.notify || char.properties.indicate);
      try {
        await wx.notifyBLECharacteristicValueChange({
          deviceId,
          serviceId: service.serviceId,
          characteristicId: notifyChar.uuid,
          state,
        });
      } catch (err) {
        console.error('修改蓝牙消息通知失败: ', err);
        throw err;
      }
    }
  }

  /**断开连接 */
  async disconnect(deviceId) {
    if (this._checkLevels(2, deviceId)) {
      if (this.config.testMode) console.log('断开蓝牙设备连接');
      try {
        await this._onMessageReceived(deviceId, false);
        await wx.closeBLEConnection({ deviceId });
        return true;
      } catch (err) {
        console.error('断开蓝牙设备连接失败: ', err);
        throw err;
      }
    }
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

export default new BluetoothManager();