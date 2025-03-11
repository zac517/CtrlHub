import BluetoothManager from './bluetoothManager.js';
import MqttManager from './mqttManager.js';

class CommunicationManager {
  constructor() {
    this.bluetoothManager = new BluetoothManager();
    this.mqttManager = new MqttManager();
    this.deviceStatus = new Map(); // 设备状态缓存
    this.messageListeners = new Set();
    this.statusListeners = new Set();
    this.connectionChangeListeners = new Set(); // 设备连接状态变化监听器
    this.localStatusListeners = new Set(); // 本机状态变化监听器
  }

  // 初始化
  async init(options) {
    const {
      bluetoothConfig,
      mqttConfig,
      onDeviceConnectionChange, // 设备连接状态变化回调
      onLocalStatusChange,      // 本机状态变化回调
      onAdapterRecovery         // 适配器恢复回调
    } = options || {};

    // 注册设备连接状态变化监听器
    if (typeof onDeviceConnectionChange === 'function') {
      this.connectionChangeListeners.add(onDeviceConnectionChange);
    }

    // 注册本机状态变化监听器
    if (typeof onLocalStatusChange === 'function') {
      this.localStatusListeners.add(onLocalStatusChange);
    }

    // 初始化蓝牙，使用回调列表
    await this.bluetoothManager.initBluetooth({
      config: bluetoothConfig,
      deviceChange: devices => this._updateDeviceStatus(devices),
      adapterChange: [
        state => this._notifyLocalStatusChange('bluetooth', state),
        state => {
          if (state.available && onAdapterRecovery) {
            onAdapterRecovery('bluetooth');
          }
        },
      ],
      connectionChange: res => {
          if (!res.connected) {
            this._notifyDeviceConnectionChange(res.deviceId, 'disconnected');
          }
      },
      messageReceived: (deviceId, message) => this._handleMessage(deviceId, message),
    });

    // 初始化 MQTT
    this.mqttManager.connect(mqttConfig);
    this.mqttManager.onConnectionStateChanged(state => {
      this._notifyLocalStatusChange('mqtt', state);
      if (state === 'connected' && onAdapterRecovery) {
        onAdapterRecovery('mqtt');
      }
    });
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
        }),
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
        }),
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
      return await this.bluetoothManager.sendMessage(deviceId, JSON.stringify(message));
    } else if (status === 'mqtt') {
      return await this.mqttManager.publish(deviceId, message);
    } else {
      throw new Error('设备离线');
    }
  }

  // 监听消息
  onMessageReceived(callback) {
    if (typeof callback === 'function') this.messageListeners.add(callback);
  }

  // 监听设备状态变化
  onDeviceStatusChanged(callback) {
    if (typeof callback === 'function') this.statusListeners.add(callback);
  }

  // 监听设备连接状态变化
  onDeviceConnectionChanged(callback) {
    if (typeof callback === 'function') this.connectionChangeListeners.add(callback);
  }

  // 监听本机状态变化
  onLocalStatusChanged(callback) {
    if (typeof callback === 'function') this.localStatusListeners.add(callback);
  }

  // 检查蓝牙在线
  async _checkBluetoothOnline(deviceId) {
    await this.bluetoothManager.startDiscovery();
    await new Promise(resolve => setTimeout(resolve, 10000)); // 扫描10秒
    await this.bluetoothManager.stopDiscovery();
    return this.bluetoothManager.deviceMap.has(deviceId);
  }

  // 检查 MQTT 在线
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

  // 通知设备状态变化
  _notifyStatusChange(id, state) {
    this.statusListeners.forEach(cb => cb(id, state));
  }

  // 通知设备连接状态变化
  _notifyDeviceConnectionChange(deviceId, state) {
    this.connectionChangeListeners.forEach(cb => cb(deviceId, state));
  }

  // 通知本机状态变化
  _notifyLocalStatusChange(type, state) {
    this.localStatusListeners.forEach(cb => cb(type, state));
  }

  // 连接设备
  async connect(deviceId) {
    const currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus === 'bluetooth' || currentStatus === 'mqtt') {
      return currentStatus;
    }

    try {
      await this.bluetoothManager.connect(deviceId);
      this.bluetoothManager.onMessageReceived(deviceId); // 启用通知
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
      this.connectionChangeListeners.clear();
      this.localStatusListeners.clear();
      console.log('CommunicationManager 资源已关闭');
    } catch (err) {
      console.error('关闭 CommunicationManager 失败:', err);
    }
  }
}

export default new CommunicationManager();