// communicationManager.js
import bluetoothManager from './bluetoothManager.js';
import MqttManager from './mqttManager.js';

class CommunicationManager {
  constructor() {
    this.bluetoothManager = bluetoothManager;
    this.mqttManager = new MqttManager();
    this.deviceStatus = new Map(); // 设备状态缓存
    this.messageListeners = new Set();
    this.statusListeners = new Set();
  }

  // 初始化
  init(options) {
    this.bluetoothManager.initBluetooth({
      config: options?.bluetooth,
      deviceChange: devices => this._updateDeviceStatus(devices),
      adapterChange: state => this._notifyStatusChange('bluetooth', state),
      messageReceived: (deviceId, message) => this._handleMessage(deviceId, message)
    });
    this.mqttManager.connect(options?.mqtt);
    this.mqttManager.onConnectionStateChanged(state => this._notifyStatusChange('mqtt', state));
    this.mqttManager.onMessageReceived((deviceId, message) => {
      this._handleMessage(deviceId, message);
    });
  }

  // 在线状态检测（单个设备）
  async checkOnlineStatus(deviceId) {
    try {
      const [bluetoothOnline, mqttOnline] = await Promise.all([
        this._checkBluetoothOnline(deviceId).catch(err => {
          console.error(`蓝牙检测失败 (${deviceId}):`, err);
          return false;
        }),
        this._checkMqttOnline(deviceId).catch(err => {
          console.error(`MQTT检测失败 (${deviceId}):`, err);
          return false;
        })
      ]);

      if (bluetoothOnline) {
        this.deviceStatus.set(deviceId, 'bluetooth');
        return true;
      }
      if (mqttOnline) {
        this.deviceStatus.set(deviceId, 'mqtt');
        return true;
      }

      this.deviceStatus.set(deviceId, 'offline');
      return false;
    } catch (err) {
      console.error(`检查在线状态失败 (${deviceId}):`, err);
      this.deviceStatus.set(deviceId, 'offline');
      return false;
    }
  }

  // 批量检测（Home页面）
  async checkMultipleOnlineStatus(deviceIds) {
    const result = new Map();
    const deviceStatusUpdates = new Map();

    try {
      const [bluetoothResults, mqttResults] = await Promise.all([
        this.bluetoothManager.fastDiscovery(1000).then(bluetoothDevices => {
          console.log(bluetoothDevices);
          const bluetoothOnlineDevices = new Set(bluetoothDevices.map(d => d.deviceId));
          return new Map(deviceIds.map(id => [id, bluetoothOnlineDevices.has(id)]));
        }).catch(err => {
          console.error('蓝牙检测失败:', err);
          return new Map(deviceIds.map(id => [id, false]));
        }),
        Promise.all(
          deviceIds.map(id =>
            this._checkMqttOnline(id)
              .then(res => [id, res])
              .catch(err => {
                console.error(`MQTT检测失败 (${id}):`, err);
                return [id, false];
              })
          )
        ).then(results => {
          const devices = new Map();
          results.forEach(([id, isOnline]) => {
            devices.set(id, isOnline);
            if (isOnline && !deviceStatusUpdates.has(id)) {
              deviceStatusUpdates.set(id, 'mqtt');
            }
          });
          return devices;
        }).catch(err => {
          console.error('MQTT批量检测失败:', err);
          return new Map(deviceIds.map(id => [id, false]));
        })
      ]);

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

      deviceStatusUpdates.forEach((status, id) => {
        this.deviceStatus.set(id, status);
      });

      return result;
    } catch (err) {
      console.error('检查多设备在线状态失败:', err);
      deviceIds.forEach(id => {
        result.set(id, false);
        this.deviceStatus.set(id, 'offline');
      });
      return result;
    }
  }

  // 发送消息
  async sendMessage(deviceId, message) {
    const status = this.deviceStatus.get(deviceId);
    if (status === 'bluetooth') {
      return this.bluetoothManager.sendMessage(deviceId, JSON.stringify(message));
    } else if (status === 'mqtt') {
      return this.mqttManager.publish(deviceId, message);
    } else {
      // 设备未连接，尝试连接后重试
      const connectionType = await this.connect(deviceId);
      if (connectionType === 'bluetooth') {
        return this.bluetoothManager.sendMessage(deviceId, JSON.stringify(message));
      } else if (connectionType === 'mqtt') {
        return this.mqttManager.publish(deviceId, message);
      }
      throw new Error('设备离线或连接失败');
    }
  }

  // 监听消息
  onMessageReceived(callback) {
    if (typeof callback === 'function') this.messageListeners.add(callback);
  }

  // 监听状态变化
  onDeviceStatusChanged(callback) {
    if (typeof callback === 'function') this.statusListeners.add(callback);
  }

  // 检查蓝牙在线
  _checkBluetoothOnline(deviceId) {
    return new Promise(resolve => {
      this.bluetoothManager.startDiscovery();
      setTimeout(() => {
        this.bluetoothManager.stopDiscovery();
        resolve(this.bluetoothManager.deviceMap.has(deviceId));
      }, 10000); // 扫描10秒
    });
  }

  // 检查 MQTT 在线
  _checkMqttOnline(deviceId) {
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

  // 处理接收到的消息
  _handleMessage(deviceId, message) {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch {
      parsedMessage = message;
    }
    this.messageListeners.forEach(cb => cb(deviceId, parsedMessage));
  }

  // 更新设备状态
  _updateDeviceStatus(devices) {
    devices.forEach(device => {
      if (this.deviceStatus.get(device.deviceId) !== 'bluetooth') {
        this.deviceStatus.set(device.deviceId, 'bluetooth');
        this._notifyStatusChange(device.deviceId, 'bluetooth');
      }
    });
  }

  _notifyStatusChange(id, state) {
    this.statusListeners.forEach(cb => cb(id, state));
  }

  async connect(deviceId) {
    const currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus === 'bluetooth' || currentStatus === 'mqtt') {
      return currentStatus;
    }

    try {
      await this.bluetoothManager.connect(deviceId);
      this.bluetoothManager.onMessageReceived(); // 启用通知
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

  // 关闭方法
  close() {
    try {
      this.bluetoothManager.closeBluetooth();
      this.mqttManager.disconnect();
      this.deviceStatus.clear();
      this.messageListeners.clear();
      this.statusListeners.clear();
      console.log('CommunicationManager 资源已关闭');
    } catch (err) {
      console.error('关闭 CommunicationManager 失败:', err);
    }
  }
}

export default CommunicationManager;