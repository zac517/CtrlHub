// bluetoothManager.js
const bluetoothManager = {
  config: {
    scanInterval: 1000,       // 扫描间隔（毫秒）
    autoOpen: true,           // 自动开启蓝牙
    reconnectInterval: 2000,  // 重连间隔（毫秒）
    updateInterval: 2000,     // 设备列表更新间隔（毫秒）
    expireTime: 5000         // 设备过期时间（毫秒），10秒未扫描到则移除
  },

  adapterState: {
    available: false,
    discovering: false,
  },
  devices: [],                // 对外暴露的设备列表
  deviceMap: new Map(),       // 存储发现的设备
  connectedDevices: new Map(),// 存储已连接设备
  pendingDiscovery: false,
  listeners: new Set(),       // 设备列表变化监听
  adapterListeners: new Set(),// 适配器状态变化监听
  updateTimer: null,          // 设备列表更新定时器

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
        if (device.name) {
          // 更新设备信息，记录最后发现时间
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
  connect(deviceId) {
    if (this.connectedDevices.has(deviceId)) return Promise.resolve(true);

    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId,
        success: () => {
          this.connectedDevices.set(deviceId, { connected: true });
          // 监听断开
          wx.onBLEConnectionStateChange(res => {
            if (!res.connected && res.deviceId === deviceId) {
              this.connectedDevices.delete(deviceId);
              this._attemptReconnect(deviceId);
            }
          });
          resolve(true);
        },
        fail: reject
      });
    });
  },

  // 断开连接
  disconnect(deviceId) {
    if (!this.connectedDevices.has(deviceId)) return;
    wx.closeBLEConnection({ deviceId });
    this.connectedDevices.delete(deviceId);
  },

  // 发送消息（假设已实现特征值读写）
  sendMessage(deviceId, message) {
    if (!this.connectedDevices.has(deviceId)) {
      return this.connect(deviceId).then(() => this.sendMessage(deviceId, message));
    }
    // 假设通过特征值发送，具体实现需根据设备协议
    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId,
        serviceId: 'SERVICE_UUID', // 示例UUID
        characteristicId: 'CHAR_UUID',
        value: this._stringToBuffer(message),
        success: resolve,
        fail: reject
      });
    });
  },

  // 接收消息（需注册特征值通知）
  onMessageReceived(callback) {
    wx.onBLECharacteristicValueChange(res => {
      callback(res.deviceId, this._bufferToString(res.value));
    });
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
    this.deviceMap.clear();
    this.devices = [];
    wx.closeBluetoothAdapter();
    wx.offBluetoothAdapterStateChange();
  }
};

export default bluetoothManager;