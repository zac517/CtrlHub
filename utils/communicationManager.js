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
      deviceCallbacks: [devices => this._updateDeviceStatus(devices)],
      adapterCallbacks: [state => this._notifyStatusChange('bluetooth', state)]
    });
    this.mqttManager.connect(options?.mqtt);
    this.mqttManager.onConnectionStateChanged(state => this._notifyStatusChange('mqtt', state));
    this.mqttManager.onMessageReceived((deviceId, message) => {
      this._handleMessage(deviceId, message);
    });
    this.bluetoothManager.onMessageReceived((deviceId, message) => {
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
        bluetoothManager.scanForDuration(3000).then(() => {
          const devices = new Map();
          deviceIds.forEach(id => {
            const isOnline = this.bluetoothManager.deviceMap.has(id);
            devices.set(id, isOnline);
            if (isOnline) {
              deviceStatusUpdates.set(id, 'bluetooth');
            }
          });
          return devices;
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
  sendMessage(deviceId, message) {
    const status = this.deviceStatus.get(deviceId);
    if (status === 'bluetooth') {
      return this.bluetoothManager.sendMessage(deviceId, JSON.stringify(message));
    } else if (status === 'mqtt') {
      return this.mqttManager.publish(deviceId, message);
    } else {
      return this.checkOnlineStatus(deviceId).then(online => {
        if (online) return this.sendMessage(deviceId, message);
        throw new Error('设备离线');
      });
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
      }, 10000); // 扫描3秒
    });
  }

  // 检查 MQTT 在线
  _checkMqttOnline(deviceId) {
    return new Promise(resolve => {
      this.mqttManager.subscribe(deviceId);
      this.mqttManager.publish(deviceId, { type: 'ping' });
      const timeout = setTimeout(() => resolve(false), 3000);
      this.mqttManager.onMessageReceived((id, msg) => {
        if (id === deviceId && msg.type === 'pong') {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });
  }

  // 扫描蓝牙设备
  _scanBluetoothDevices() {
    return new Promise(resolve => {
      this.bluetoothManager.startDiscovery();
      setTimeout(() => {
        this.bluetoothManager.stopDiscovery();
        resolve();
      }, 10000);
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
      if (!this.deviceStatus.get(device.deviceId) === 'bluetooth') {
        this.deviceStatus.set(device.deviceId, 'bluetooth');
        this._notifyStatusChange(device.deviceId, 'bluetooth');
      }
    });
  }

  _notifyStatusChange(id, state) {
    this.statusListeners.forEach(cb => cb(id, state));
  }

  // 新增关闭方法
  close() {
    try {
      // 关闭蓝牙连接
      this.bluetoothManager.closeBluetooth();

      // 关闭 MQTT 连接
      this.mqttManager.disconnect();

      // 清理设备状态缓存
      this.deviceStatus.clear();

      // 清理消息监听器
      this.messageListeners.clear();

      // 清理状态监听器
      this.statusListeners.clear();

      console.log('CommunicationManager 资源已关闭');
    } catch (err) {
      console.error('关闭 CommunicationManager 失败:', err);
    }
  }
}

export default CommunicationManager;