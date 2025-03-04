// bluetoothManager.js
const bluetoothManager = {
  config: {
    scanInterval: 1000,
    autoOpen: true,
    reconnectInterval: 2000,
    updateInterval: 2000,
    expireTime: 5000,
    rssiThreshold: -80
  },

  adapterState: { available: false, discovering: false },
  devices: [],
  deviceMap: new Map(),
  connectedDevices: new Map(),
  deviceServicesMap: new Map(),  // 新增：存储服务和特征值
  pendingDiscovery: false,
  listeners: new Set(),
  adapterListeners: new Set(),
  updateTimer: null,

  // 初始化
  initBluetooth(options = {}) {
    this.config = { ...this.config, ...options.config };
    
    // 注册回调
    if (options.deviceCallbacks) {
      options.deviceCallbacks.forEach(cb => this.addDeviceListener(cb));
    }
    if (options.adapterCallbacks) {
      options.adapterCallbacks.forEach(cb => this.addAdapterListener(cb));
    }

    // 监听适配器状态变化
    wx.onBluetoothAdapterStateChange(res => {
      this.adapterState = res;
      this._notifyAdapterListeners(res);
      if (res.available && this.pendingDiscovery) {
        this.startDiscoverySon();
      } else if (!res.available && this.config.autoOpen) {
        this._checkAndOpenBluetooth();
      }
    });
    this._checkAndOpenBluetooth();
  },

  // 开启蓝牙适配器
  _checkAndOpenBluetooth() {
    wx.openBluetoothAdapter({
      success: () => {
        this.adapterState.available = true;
        if (this.pendingDiscovery) {
          this.startDiscoverySon();
        }
      },
      fail: () => setTimeout(() => this._checkAndOpenBluetooth(), 2000)
    });
  },

  // 监听设备发现
  _listenDeviceFound() {
    wx.offBluetoothDeviceFound();
    wx.onBluetoothDeviceFound(res => {
      res.devices.forEach(device => {
        if (device.name && device.RSSI > this.config.rssiThreshold) {
          const enhancedDevice = { ...device, lastSeen: Date.now() };
          this.deviceMap.set(device.deviceId, enhancedDevice);
        }
      });
    });
  },

  // 开始扫描
  startDiscovery() {
    this.pendingDiscovery = true;
    this.deviceMap.clear();  // 清空设备列表
    this.devices = [];
    if (this.adapterState?.available) {
      this.startDiscoverySon();
      // 启动定时器，每隔 updateInterval 更新设备列表
      this.updateTimer = setInterval(() => {
        this._updateDevices();
      }, this.config.updateInterval);
    }
  },

  startDiscoverySon() {
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true, // 允许重复上报设备
      interval: this.config.scanInterval,
      success: () => this._listenDeviceFound(),
    });
  },

  stopDiscovery() {
    this.pendingDiscovery = false;
    wx.stopBluetoothDevicesDiscovery();
    wx.offBluetoothDeviceFound();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this._updateDevices(); // 停止扫描时立即更新一次设备列表
  },

  // 更新设备列表并移除过期设备
  _updateDevices() {
    const now = Date.now();
    // 移除过期设备
    this.deviceMap.forEach((device, deviceId) => {
      if (now - device.lastSeen > this.config.expireTime) {
        this.deviceMap.delete(deviceId);
      }
    });
    // 更新 devices 列表
    this.devices = Array.from(this.deviceMap.values());
    this._notifyListeners();
  },

  // 快速扫描指定时长
  scanForDuration(duration) {
    return new Promise((resolve) => {
      this.deviceMap.clear();  // 清空设备列表
      this.devices = [];
      this.pendingDiscovery = true;
      if (this.adapterState?.available) {
        this.startDiscoverySon();
        setTimeout(() => {
          this.stopDiscovery();
          resolve(this.devices);
        }, duration);
      } else {
        resolve([]);
      }
    });
  },

  // 连接设备
  // 连接设备并获取服务和特征值
  connect(deviceId) {
    if (this.connectedDevices.has(deviceId)) return Promise.resolve(true);

    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId,
        success: () => {
          this.connectedDevices.set(deviceId, { connected: true });
          // 监听连接状态变化
          wx.onBLEConnectionStateChange(res => {
            if (!res.connected && res.deviceId === deviceId) {
              this.connectedDevices.delete(deviceId);
              this.deviceServicesMap.delete(deviceId);  // 断开时清理服务数据
              this._attemptReconnect(deviceId);
            }
          });
          // 获取服务和特征值
          this._discoverServicesAndCharacteristics(deviceId)
            .then(() => resolve(true))
            .catch(reject);
        },
        fail: reject
      });
    });
  },

  // 新增：发现服务和特征值
  _discoverServicesAndCharacteristics(deviceId) {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId,
        success: res => {
          const services = res.services;
          const servicePromises = services.map(service => {
            return new Promise((resolveService, rejectService) => {
              wx.getBLEDeviceCharacteristics({
                deviceId,
                serviceId: service.uuid,
                success: charRes => {
                  resolveService({ serviceId: service.uuid, characteristics: charRes.characteristics });
                },
                fail: rejectService
              });
            });
          });
          Promise.all(servicePromises)
            .then(serviceData => {
              this.deviceServicesMap.set(deviceId, serviceData);
              resolve();
            })
            .catch(reject);
        },
        fail: reject
      });
    });
  },

  // 发送消息（使用存储的服务和特征值）
  sendMessage(deviceId, message) {
    if (!this.connectedDevices.has(deviceId)) {
      return this.connect(deviceId).then(() => this.sendMessage(deviceId, message));
    }

    const serviceData = this.deviceServicesMap.get(deviceId);
    if (!serviceData || serviceData.length === 0) {
      return Promise.reject(new Error('No services found for this device'));
    }

    // 假设使用第一个服务和第一个可写的特征值（实际需根据协议调整）
    const service = serviceData[0];
    const writableChar = service.characteristics.find(char => char.properties.write || char.properties.writeNoResponse);
    if (!writableChar) {
      return Promise.reject(new Error('No writable characteristic found'));
    }

    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId,
        serviceId: service.serviceId,
        characteristicId: writableChar.uuid,
        value: this._stringToBuffer(message),
        success: resolve,
        fail: reject
      });
    });
  },

  // 接收消息（启用特征值通知）
  onMessageReceived(callback) {
    wx.onBLECharacteristicValueChange(res => {
      callback(res.deviceId, this._bufferToString(res.value));
    });
    // 启用通知（需在连接后为特定特征值启用）
    this.connectedDevices.forEach((_, deviceId) => {
      const serviceData = this.deviceServicesMap.get(deviceId);
      if (serviceData && serviceData.length > 0) {
        const service = serviceData[0];
        const notifyChar = service.characteristics.find(char => char.properties.notify || char.properties.indicate);
        if (notifyChar) {
          wx.notifyBLECharacteristicValueChange({
            deviceId,
            serviceId: service.serviceId,
            characteristicId: notifyChar.uuid,
            state: true
          });
        }
      }
    });
  },

  // 断开连接
  disconnect(deviceId) {
    if (!this.connectedDevices.has(deviceId)) return;
    wx.closeBLEConnection({ deviceId });
    this.connectedDevices.delete(deviceId);
  },

  // 自动重连
  _attemptReconnect(deviceId) {
    setTimeout(() => {
      this.connect(deviceId).catch(() => this._attemptReconnect(deviceId));
    }, this.config.reconnectInterval);
  },

  // 工具函数
  _stringToBuffer(str) {
    const ab = new ArrayBuffer(str.length * 2);
    const view = new Uint16Array(ab);
    for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
    return ab;
  },

  _bufferToString(buffer) {
    return String.fromCharCode.apply(null, new Uint16Array(buffer));
  },

  // 监听器管理
  _notifyListeners() {
    const list = Array.from(this.deviceMap.values());
    this.listeners.forEach(cb => cb(list));
  },

  _notifyAdapterListeners(state) {
    this.adapterListeners.forEach(cb => cb(state));
  },

  addDeviceListener(callback) {
    if (typeof callback === 'function') this.listeners.add(callback);
  },

  addAdapterListener(callback) {
    if (typeof callback === 'function') this.adapterListeners.add(callback);
  },

  removeDeviceListener(callback) {
    this.listeners.delete(callback);
  },

  removeAdapterListener(callback) {
    this.adapterListeners.delete(callback);
  },

  // 清理
  closeBluetooth() {
    this.listeners.clear();
    this.adapterListeners.clear();
    this.stopDiscovery();
    this.connectedDevices.clear();
    this.deviceServicesMap.clear();  // 清理服务数据
    this.deviceMap.clear();
    this.devices = [];
    wx.closeBluetoothAdapter();
    wx.offBluetoothAdapterStateChange();
  }
};

export default bluetoothManager;