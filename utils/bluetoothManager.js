// bluetoothManager.js
const bluetoothManager = {
  config: {
    // 通用配置
    restartInterval: 2000, // 重启适配器间隔 
    shouldRetryOpen: false, // 控制重启
    rssiThreshold: -80, // 信号阈值 
    testMode: true, // 测试模式

    // 持续扫描模式配置
    scanInterval: 2000, // 扫描间隔 
    expireTime: 5000,  // 设备保留时间
    updateInterval: 2000, // 设备列表更新间隔 
  },

  // 通用
  adapterState: { available: false, discovering: false },
  realRestartInterval: 2000, // 实际重启间隔
  adapterChange: null, // 适配器变化回调 
  initSuccess: null, // 初始化成功回调

  // 扫描设备
  devices: [],
  deviceMap: new Map(),
  deviceChange: null, // 设备列表变化回调
  updateTimer: null, // 更新设备列表定时器
  
  // 设备连接
  connected: false, 
  deviceId: '',
  serviceData: null, // 存储服务和特征值
  connectionChange: null, // 连接状态改变回调

  // 信息接收
  messageReceived: null, // 收到回调

  // 初始化蓝牙适配器
  initBluetooth(options = {}) {
    if (this.config.testMode) console.log('initBluetooth');
    this.config = { ...this.config, ...options.config };
    this.deviceChange = options.deviceChange;
    this.adapterChange = options.adapterChange;
    this.connectionChange = options.connectionChange;
    this.messageReceived = options.messageReceived;
    this.initSuccess = options.success;

    // 监听适配器状态变化
    wx.onBluetoothAdapterStateChange(res => {
      if (this.config.testMode) console.log('adapterChange: ' + res.available + ', ' + res.discovering);
      let lastAdapterState = this.adapterState;
      this.adapterState = res;
      if (this.adapterChange) this.adapterChange(res);
      if (!lastAdapterState.available) {
        if (this.config.testMode) console.log('initSuccess');
        if (this.initSuccess) this.initSuccess();
      }
    });

    this.config.shouldRetryOpen = true;
    // 第一次开启适配器 手动开启
    this.realRestartInterval = this.config.restartInterval;
    this._openBluetooth();
  },

  // 开启蓝牙适配器 初始化页面时调用一次 执行直到开启
  _openBluetooth() {
    if (this.config.testMode) console.log('openBluetooth');
    if (this.adapterState.available) {
      console.log("已开启？");
      return;
    };
    wx.openBluetoothAdapter({
      success: () => {
        this.adapterState.available = true;
        if (this.config.testMode) console.log('initSuccess');
        if (this.initSuccess) this.initSuccess();
      },
      fail: (res) => {
        if (this.config.shouldRetryOpen) setTimeout(() => this._openBluetooth(), this.realRestartInterval);
        this.realRestartInterval = this.realRestartInterval * 1.5;
      }
    });
  },



  // 开始扫描
  startDiscovery(mode = 'continuous') {
    if (this.config.testMode) console.log('startDiscovery');
    this.deviceMap.clear();  // 清空设备列表
    this.devices = [];
    if (this.adapterState?.available) {
      if (mode == 'continuous') {
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: true, // 允许重复上报设备
          interval: this.config.scanInterval,
          success: () => this._listenDeviceFound('continuous'),
        });
          // 启动定时器，每隔 updateInterval 更新设备列表
        this.updateTimer = setInterval(() => {
          this._updateDevices();
        }, this.config.updateInterval);
      }
      else if (mode == 'fast') {
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: true, // 允许重复上报设备
          powerLevel: 'high',
          success: () => this._listenDeviceFound('fast'),
          fail: (res) => console.log(res.errMsg)
        });
      }
    }
  },

  // 快速扫描
  fastDiscovery(duration = 1000) {
    if (this.config.testMode) console.log('fastDiscovery');
    return new Promise((resolve, reject) => {
      this.startDiscovery('fast');
      setTimeout(() => {
          this.stopDiscovery();
          resolve(Array.from(this.deviceMap.values()));
      }, duration);
    });
  },

  // 监听设备发现
  _listenDeviceFound(mode = 'continuous') {
    if (this.config.testMode) console.log('listenDeviceFound');
    wx.offBluetoothDeviceFound();
    wx.onBluetoothDeviceFound(res => {
      if (this.config.testMode) console.log('deviceFound');
      res.devices.forEach(device => {
        if (device.name && device.RSSI > this.config.rssiThreshold) {
          if (mode == 'continuous') {
            const enhancedDevice = { ...device, lastSeen: Date.now() };
            this.deviceMap.set(device.deviceId, enhancedDevice);
          }
          else if (mode == 'fast') {
            this.deviceMap.set(device.deviceId, device);
          }
        }
      });
    });
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
    if (this.deviceChange) this.deviceChange(this.devices);
  },

  stopDiscovery() {
    wx.stopBluetoothDevicesDiscovery();
    wx.offBluetoothDeviceFound();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  },



  // 连接设备并获取服务和特征值
  connect(deviceId) {
    if (this.config.testMode) console.log('connect');
    if (this.connected) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId,
        success: () => {
          this.deviceId = deviceId;
          this.connected = true;
          // 监听连接状态变化
          wx.onBLEConnectionStateChange(res => {
            if (this.config.testMode) console.log('connectChange');
            if (!res.connected && res.deviceId === deviceId) {
              this.connected = false;
              this.deviceServicesMap.delete(deviceId);  // 断开时清理服务数据
              if (this.connectionChange) this.connectionChange(res);
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

  // 发现服务和特征值
  _discoverServicesAndCharacteristics(deviceId) {
    if (this.config.testMode) console.log('discoverServicesAndCharacteristics');
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
              this.serviceData = serviceData;
              resolve();
            })
            .catch(reject);
        },
        fail: reject
      });
    });
  },

  // 发送消息（使用存储的服务和特征值）
  sendMessage(message) {
    if (this.config.testMode) console.log('sendMessage');
    if (!this.connected) return;

    const serviceData = this.serviceData;
    if (!serviceData || serviceData.length === 0) {
      return Promise.reject(new Error('No services found for this device'));
    }

    // 假设使用第一个服务和第一个可写的特征值
    const service = serviceData[0];
    const writableChar = service.characteristics.find(char => char.properties.write || char.properties.writeNoResponse);
    if (!writableChar) {
      return Promise.reject(new Error('No writable characteristic found'));
    }

    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId: this.deviceId,
        serviceId: service.serviceId,
        characteristicId: writableChar.uuid,
        value: this._stringToBuffer(message),
        success: resolve,
        fail: reject
      });
    });
  },

  // 接收消息（启用特征值通知）
  onMessageReceived() {
    if (this.config.testMode) console.log('onMessageReceived');
    wx.onBLECharacteristicValueChange(res => {
      if (this.config.testMode) console.log('messageReceived');
      if (this.messageReceived) this.messageReceived(res.deviceId, this._bufferToString(res.value));
    });

    // 启用通知（需在连接后为特定特征值启用）
    const serviceData = this.serviceData;
    if (serviceData && serviceData.length > 0) {
      const service = serviceData[0];
      const notifyChar = service.characteristics.find(char => char.properties.notify || char.properties.indicate);
      if (notifyChar) {
        wx.notifyBLECharacteristicValueChange({
          deviceId: this.deviceId,
          serviceId: service.serviceId,
          characteristicId: notifyChar.uuid,
          state: true
        });
      }
    }
  },

  // 断开连接
  disconnect(deviceId) {
    if (!this.connected) return;
    wx.closeBLEConnection({ deviceId });
    this.deviceId = '';
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

  // 清理
  closeBluetooth() {
    if (this.config.testMode) console.log('closeBluetooth');

    this.config.shouldRetryOpen = false;
    this.deviceChange = null;
    this.connectionChange = null;
    this.adapterChange = null;
    this.messageReceived = null;
    this.initSuccess = null;
    this.adapterState = { available: false, discovering: false };

    this.stopDiscovery();
    this.deviceMap.clear();
    this.devices = [];
    wx.offBluetoothAdapterStateChange();
    wx.closeBluetoothAdapter();
  }
};

export default bluetoothManager;