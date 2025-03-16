class BluetoothManager {
  constructor(config) {
    const deviceInfo = wx.getDeviceInfo();
    /**当前平台 */
    this.platform = deviceInfo.platform;

    if (this._checkLevels(0)) {
      /**配置 */
      this.config = {
        /**测试模式 */
        testMode: true,
        /**扫描间隔 */
        scanInterval: 2000,
        /**信号阈值 */
        rssiThreshold: -80,
      };
      this.config = { ...this.config, ...config };
      if (this.config.testMode) console.log('蓝牙模块初始化');
  
      this.adapterChangeListeners = new Set();
      this.deviceChangeListeners = new Set();
      this.connectionChangeListeners = new Set();
      this.messageReceivedListeners = new Set();

      /**任务 */
      this.task = null;
      /**蓝牙适配器状态 */
      this.adapterState = { available: false, discovering: false };
      /**已发现的设备 */
      this.devices = new Map();
      /**快速扫描发现的设备 */
      this.fastDevices = new Map();
      /**已连接的设备 */
      this.connectedDevices = new Map();

      this.init();
    }
  }

  /**初始化函数 
   * 
   * 由于添加监听器需要在尝试开启适配器后进行，而构造函数不支持`async`标识符，而设计
  */
  async init() {
    if (this.config.testMode) console.log('尝试开启蓝牙适配器');
    try {
      await wx.openBluetoothAdapter();
      this.adapterState = { available: true, discovering: false };
    } catch (err) {
      console.log('开启蓝牙适配器失败: ' + err);
    }

    /**添加适配器状态变化监听器 */
    wx.onBluetoothAdapterStateChange(res => {
      if (this.config.testMode) console.log('蓝牙适配器状态变化为: ' + JSON.stringify(res));
      const lastAdapterState = this.adapterState;
      this.adapterState = res;
      this.adapterChangeListeners.forEach(cb => cb(res));
      if (!lastAdapterState.available && res.available) {
        if (this.config.testMode) console.log('蓝牙适配器恢复');
        if (this.task?.recover) this.task.recover();
      }
    });

    /**添加设备发现监听器 */
    wx.onBluetoothDeviceFound(res => {
      if (this.config.testMode) console.log('蓝牙发现设备');
      console.log(res.devices);
      res.devices.forEach(device => {
        if (device.name && device.RSSI > this.config.rssiThreshold) {
          this.devices.set(device.deviceId, device);
          this.fastDevices.set(device.deviceId, device);
        }
      });
      this.deviceChangeListeners.forEach(cb => cb(Array.from(this.devices.values())));
      this.devices.clear();
    });

    /**添加设备连接监听器 */
    wx.onBLEConnectionStateChange(res => {
      if (this.config.testMode) console.log('蓝牙设备连接状态变化');
      if (!res.connected) this.connectedDevices.delete(res.deviceId);
      this.connectionChangeListeners.forEach(cb => cb(res));
    });

    /**添加消息监听器 */
    wx.onBLECharacteristicValueChange(res => {
      if (this.config.testMode) console.log('蓝牙收到消息');
      this.messageReceivedListeners.forEach(cb => cb(res.deviceId, this.bufferToString(res.value)));
    });
  }

  /**检查条件 */
  _checkLevels(level, deviceId = '') {
    if (this.platform == 'devtools') {
      console.log("当前平台为 devtools，不支持蓝牙相关功能");
      return false;
    };
    if (level == 0) return true;


    if (!this.adapterState.available) {
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
  begin(options) {
    if (this._checkLevels(0)) {
      this.task = options.task;
      this._registerCallbacks(options.onAdapterChange, this.adapterChangeListeners);
      this._registerCallbacks(options.onDeviceChange, this.deviceChangeListeners);
      this._registerCallbacks(options.onConnectionChange, this.connectionChangeListeners);
      this._registerCallbacks(options.onMessageReceived, this.messageReceivedListeners);
      console.log(this.task);
      if (this.task?.setup) this.task.setup();
    }
  }

  /**结束任务函数 */
  finish() {
    if (this._checkLevels(0)) {
      if (this.task?.end) this.task.end();
      this.task = null;
      this.adapterChangeListeners.clear();
      this.deviceChangeListeners.clear();
      this.connectionChangeListeners.clear();
      this.messageReceivedListeners.clear();
    }
  }

  /**开启扫描 */
  async startDiscovery(fast = false) {
    if (this._checkLevels(1)) {
      if (this.config.testMode) console.log('蓝牙开启扫描');
      try {
        await wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: true,
          interval: fast ? 0 : this.config.scanInterval,
          powerLevel: fast ? 'high' : 'medium',
        });
      } catch (err) {
        console.error('蓝牙开启扫描失败:', err);
      }
    }
  }

  /**快速扫描 */
  async fastDiscovery(duration = 1000) {
    if (this._checkLevels(1)) {
      if (this.config.testMode) console.log('蓝牙快速扫描');
      this.fastDevices.clear();
      try {
        await this.startDiscovery('fast');
        await new Promise(resolve => setTimeout(resolve, duration));
        await this.stopDiscovery();
      } catch (err) {
        console.error('蓝牙快速扫描失败:', err);
      }
      return Array.from(this.fastDevices.values());
    }
    else {
      return [];
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

  /**注册回调，支持列表或单个函数 */
  _registerCallbacks(callbacks, listenerSet) {
    if (Array.isArray(callbacks)) {
      callbacks.forEach(cb => {
        if (typeof cb === 'function') listenerSet.add(cb);
      });
    } else if (typeof callbacks === 'function') {
      listenerSet.add(callbacks);
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