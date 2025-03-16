import BluetoothManager from './bluetoothManager.js';
import MqttManager from './mqttManager.js';

class CommunicationManager {
  constructor() {
    this.mqttManager = new MqttManager();
    this.deviceStatus = new Map(); // 设备状态缓存

    this.messageListeners = new Set();
    this.statusListeners = new Set();
    this.connectionChangeListeners = new Set();
    this.localStatusListeners = new Set();
    this.adapterRecoveryListeners = new Set();
  }

  /** 初始化 */
  async init(options = {}) {
    const {
      mqttConfig,
      onDeviceConnectionChange,
      onLocalStatusChange,
      onStatusChange,
      onAdapterRecovery,
      onMessageReceived
    } = options;

    // 注册回调函数，支持单个函数或函数列表
    this._registerCallbacks(onDeviceConnectionChange, this.connectionChangeListeners);
    this._registerCallbacks(onLocalStatusChange, this.localStatusListeners);
    this._registerCallbacks(onAdapterRecovery, this.adapterRecoveryListeners);
    this._registerCallbacks(onMessageReceived, this.messageListeners);
    this._registerCallbacks(onStatusChange, this.statusListeners);

    BluetoothManager.begin({
      onDeviceChange: devices => this._updateDeviceStatus(devices),
      onAdapterChange: state => this._notifyLocalStatusChange('bluetooth', state),
      onConnectionChange: res => this._notifyDeviceConnectionChange(res),
      onMessageReceived: (deviceId, message) => this._handleMessage(deviceId, message),
      task: {
        recover: () => this._notifyCallbacks(this.adapterRecoveryListeners, 'bluetooth'),
      }
    })

    // 初始化 MQTT
    this.mqttManager.connect(mqttConfig);
    this.mqttManager.onConnectionStateChanged(state => {
      this._notifyLocalStatusChange('mqtt', state);
      if (state === 'connected') {
        this._notifyCallbacks(this.adapterRecoveryListeners, 'mqtt');
      }
    });
    this.mqttManager.onMessageReceived((deviceId, message) => {
      this._handleMessage(deviceId, message);
    });
  }

  /** 在线状态批量检测 */
  async checkMultipleOnlineStatus(deviceIds) {
    const result = new Map();
    const deviceStatusUpdates = new Map();

    try {
      const bluetoothResults = await this.getBluetoothOnlineStatus(deviceIds);
      const mqttResults = await this.getMqttOnlineStatus(deviceIds, deviceStatusUpdates);
      this.mergeResults(deviceIds, bluetoothResults, mqttResults, result, deviceStatusUpdates);
      this.updateDeviceStatus(deviceStatusUpdates);

      return result;
    } catch (err) {
      console.error('检查多设备在线状态失败:', err);
      this.handleError(deviceIds, result);
      return result;
    }
  }

  /** 获取蓝牙在线状态 */
  async getBluetoothOnlineStatus(deviceIds) {
    try {
      const bluetoothDevices = await BluetoothManager.fastDiscovery(1000);
      const bluetoothOnlineDevices = new Set(bluetoothDevices.map(d => d.deviceId));
      return new Map(deviceIds.map(id => [id, bluetoothOnlineDevices.has(id)]));
    } catch (err) {
      console.error('蓝牙检测失败:', err);
      return new Map(deviceIds.map(id => [id, false]));
    }
  }

  /** 获取 MQTT 在线状态 */
  async getMqttOnlineStatus(deviceIds, deviceStatusUpdates) {
    const results = await Promise.all(
      deviceIds.map(async id => {
        try {
          const res = await this._checkMqttOnline(id);
          return [id, res];
        } catch (err) {
          console.error(`MQTT检测失败 (${id}):`, err);
          return [id, false];
        }
      })
    );
    const devices = new Map();
    results.forEach(([id, isOnline]) => {
      devices.set(id, isOnline);
      if (isOnline && !deviceStatusUpdates.has(id)) {
        deviceStatusUpdates.set(id, 'mqtt');
      }
    });
    return devices;
  }

  /** 合并蓝牙和 MQTT 检测结果 */
  mergeResults(deviceIds, bluetoothResults, mqttResults, result, deviceStatusUpdates) {
    deviceIds.forEach(id => {
      const bluetoothOnline = bluetoothResults.get(id) || false;
      const mqttOnline = mqttResults.get(id) || false;

      if (bluetoothOnline) {
        result.set(id, true);
        deviceStatusUpdates.set(id, 'bluetooth');
      } else if (mqttOnline) {
        result.set(id, true);
        deviceStatusUpdates.set(id, 'mqtt');
      } else {
        result.set(id, false);
        deviceStatusUpdates.set(id, 'offline');
      }
    });
  }

  /** 更新设备状态 */
  updateDeviceStatus(deviceStatusUpdates) {
    deviceStatusUpdates.forEach((status, id) => {
      this.deviceStatus.set(id, status);
    });
  }

  /** 处理错误情况 */
  handleError(deviceIds, result) {
    deviceIds.forEach(id => {
      result.set(id, false);
      this.deviceStatus.set(id, 'offline');
    });
  }

  /** 发送消息 */
  async sendMessage(deviceId, message) {
    const status = this.deviceStatus.get(deviceId);
    if (status === 'bluetooth') {
      return await BluetoothManager.sendMessage(deviceId, message);
    } else if (status === 'mqtt') {
      return await this.mqttManager.publish(deviceId, message);
    } else {
      throw new Error('设备离线');
    }
  }

  /** 连接设备 */
  async connect(deviceId) {
    const currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus === 'bluetooth' || currentStatus === 'mqtt') {
      return currentStatus;
    }

    try {
      await BluetoothManager.connect(deviceId);
      BluetoothManager.onMessageReceived(deviceId); // 启用通知
      this.deviceStatus.set(deviceId, 'bluetooth');
      this._notifyStatusChange(deviceId, 'bluetooth');
      return 'bluetooth';
    } catch (bluetoothErr) {
      console.error(`蓝牙连接失败 (${deviceId}):`, bluetoothErr);
      try {
        if (!this.mqttManager.connected) {
          throw new Error('MQTT 客户端未连接');
        }
        this.mqttManager.subscribe(deviceId);
        this.deviceStatus.set(deviceId, 'mqtt');
        this._notifyStatusChange(deviceId, 'mqtt');
        return 'mqtt';
      } catch (mqttErr) {
        console.error(`MQTT 订阅失败 (${deviceId}):`, mqttErr);
        this.deviceStatus.set(deviceId, 'offline');
        this._notifyStatusChange(deviceId, 'offline');
        throw new Error('无法连接到设备');
      }
    }
  }

  /** 关闭方法 */
  async close() {
    try {
      BluetoothManager.finish();
      this.mqttManager.disconnect();
      this.deviceStatus.clear();
      this.messageListeners.clear();
      this.statusListeners.clear();
      this.connectionChangeListeners.clear();
      this.localStatusListeners.clear();
      this.adapterRecoveryListeners.clear();
    } catch (err) {
      console.error('关闭 CommunicationManager 失败:', err);
    }
  }

  /** 注册回调函数，支持单个函数或函数列表 */
  _registerCallbacks(callbacks, listenerSet) {
    if (Array.isArray(callbacks)) {
      callbacks.forEach(cb => {
        if (typeof cb === 'function') {
          listenerSet.add(cb);
        }
      });
    } else if (typeof callbacks === 'function') {
      listenerSet.add(callbacks);
    }
  }

  /** 触发回调函数，支持单个函数或函数列表 */
  _notifyCallbacks(callbacks, ...args) {
    if (Array.isArray(callbacks)) {
      callbacks.forEach(cb => {
        if (typeof cb === 'function') {
          cb(...args);
        }
      });
    } else {
      callbacks.forEach(cb => {
        if (typeof cb === 'function') {
          cb(...args);
        }
      });
    }
  }

  /** 检查 MQTT 在线 */
  async _checkMqttOnline(deviceId) {
    return new Promise(resolve => {
      this.mqttManager.subscribe(deviceId);
      this.mqttManager.publish(deviceId, { type: 'ping' });
      const timeout = setTimeout(() => resolve(false), 1000);
      this.mqttManager.onMessageReceived((id, msg) => {
        if (id === deviceId && msg.type === 'pong') {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });
  }

  /** 处理接收到的消息 */
  _handleMessage(deviceId, message) {
    this._notifyCallbacks(this.messageListeners, deviceId, message);
  }

  /** 更新设备状态 */
  _updateDeviceStatus(devices) {
    devices.forEach(device => {
      if (this.deviceStatus.get(device.deviceId) !== 'bluetooth') {
        this.deviceStatus.set(device.deviceId, 'bluetooth');
        this._notifyStatusChange(device.deviceId, 'bluetooth');
      }
    });
  }

  /** 通知设备状态变化 */
  _notifyStatusChange(id, state) {
    this._notifyCallbacks(this.statusListeners, id, state);
  }

  /** 通知设备连接状态变化 */
  _notifyDeviceConnectionChange(res) {
    const { deviceId, connected } = res;
    if (!connected) {
      // 设备断开连接，更新状态为 'offline'
      this.deviceStatus.set(deviceId, 'offline');
      this._notifyStatusChange(deviceId, 'offline');
    } else {
      // 设备连接成功，假设通过蓝牙连接，更新状态为 'bluetooth'
      this.deviceStatus.set(deviceId, 'bluetooth');
      this._notifyStatusChange(deviceId, 'bluetooth');
    }
    this._notifyCallbacks(this.connectionChangeListeners, res);
  }

  /** 通知本机状态变化 */
  _notifyLocalStatusChange(type, state) {
    if (type === 'bluetooth' && !state.available) {
      // 蓝牙适配器关闭，将所有蓝牙设备状态改为 'offline'
      this.deviceStatus.forEach((status, deviceId) => {
        if (status === 'bluetooth') {
          this.deviceStatus.set(deviceId, 'offline');
          this._notifyStatusChange(deviceId, 'offline');
        }
      });
    }
    this._notifyCallbacks(this.localStatusListeners, type, state);
  }
}

export default new CommunicationManager();