import BluetoothManager from './bluetoothManager.js';
import MqttManager from './mqttManager.js';

class CommunicationManager {
  constructor() {
    /**设备状态缓存 */
    this.deviceStatus = new Map();

    /**状态 */
    this.state = {
      bluetooth: { available: false, discovering: false },
      mqtt: false,
    };

    this.stateListeners = new Set();
    this.connectionListeners = new Set();
    this.messageListeners = new Set();

    this.init();
  }

  /** 初始化 */
  async init() {
    // 开始蓝牙任务
    BluetoothManager.begin({
      onStateChange: state => {
        this.state.bluetooth = state;
        this.stateListeners.forEach(cb => cb(this.state));
      },
      onConnectionChange: res => {
        const { deviceId, connected } = res;
        const deviceStatus = this.deviceStatus.get(deviceId);
        this.deviceStatus.set(deviceId, { ...deviceStatus, bluetooth: connected });
        this.connectionListeners.forEach(cb => cb(deviceId, this.deviceStatus.get(deviceId)));
      },
      onMessageReceived: (deviceId, message) => {
        this.messageListeners.forEach(cb => cb(deviceId, message));
      },
    })

    // 开始 MQTT 任务
    MqttManager.begin({
      onStateChange: state => {
        this.state.mqtt = state;
        this.stateListeners.forEach(cb => cb(this.state));
      },
      onMessageReceived: (deviceId, message) => {
        this.messageListeners.forEach(cb => cb(deviceId, message));
      },
    });
  }

  /**初始化并开始任务函数 */
  begin(options) {
    this.task = options.task;
    this._registerCallbacks(options.onStateChange, this.stateListeners);
    this._registerCallbacks(options.onConnectionChange, this.connectionListeners);
    this._registerCallbacks(options.onMessageReceived, this.messageListeners);
    if (this.task?.setup) this.task.setup();
  }

  /**结束任务函数 */
  finish() {
    if (this.task?.end) this.task.end();
    this.task = null;
    this.stateListeners.clear();
    this.connectionListeners.clear();
    this.messageListeners.clear();
  }

  /**连接设备 */
  async connect(deviceId) {
    let currentStatus = this.deviceStatus.get(deviceId);
    if (!currentStatus?.bluetooth) {
      try {
        await BluetoothManager.connect(deviceId);
      }
      catch {};
    }

    currentStatus = this.deviceStatus.get(deviceId);
    if (!currentStatus?.mqtt) {
      MqttManager.subscribe(deviceId);
      this.deviceStatus.set(deviceId, { ...currentStatus, mqtt: true });
    }
  }

  /**断开连接 */
  async disconnect(deviceId) {
    const currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus?.bluetooth) {
      try {
        await BluetoothManager.disconnect(deviceId);
      }
      catch {};
    }

    if (currentStatus?.mqtt) {
      MqttManager.unsubscribe(deviceId);
      this.deviceStatus.set(deviceId, { ...currentStatus, mqtt: false });
    }
  }

  /** 发送消息 */
  async sendMessage(deviceId, message) {
    const status = this.deviceStatus.get(deviceId);
    console.log(status);
    if (status?.bluetooth) {
      return await BluetoothManager.sendMessage(deviceId, message);
    } else if (status?.mqtt) {
      return MqttManager.publish(deviceId, message);
    } else {
      throw new Error('设备离线');
    }
  }

  /** 在线状态批量检测 */
  async checkMultipleOnlineStatus(deviceIds) {
    const result = new Map();

    try {
      const bluetoothResults = await this.getBluetoothOnlineStatus(deviceIds);
      const mqttResults = await this.getMqttOnlineStatus(deviceIds);
      deviceIds.forEach(id => {
        const bluetoothOnline = bluetoothResults.get(id) || false;
        const mqttOnline = mqttResults.get(id) || false;
        if (!bluetoothOnline && !mqttOnline) result.set(id, false);
        else result.set(id, true);
      });

      return result;
    } catch (err) {
      console.error('检查多设备在线状态失败:', err);
      deviceIds.forEach(id => result.set(id, false));
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
  async getMqttOnlineStatus(deviceIds) {
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
    results.forEach(([id, isOnline]) => devices.set(id, isOnline));
    return devices;
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

  /** 检查 MQTT 在线 */
  async _checkMqttOnline(deviceId) {
    return new Promise(resolve => {
      MqttManager.subscribe(deviceId);
      MqttManager.publish(deviceId, JSON.stringify({ type: 'ping' }));
      const listener = (id, msg) => {
        msgObject = JSON.parse(msg);
        if (id === deviceId && msgObject.type === 'pong') {
          clearTimeout(timeout);
          MqttManager.messageListeners.delete(listener);
          resolve(true);
        }
      }
      MqttManager.messageListeners.add(listener);
      const timeout = setTimeout(() => {
        MqttManager.messageListeners.delete(listener);
        resolve(false);
      }, 1000);
    });
  }
}

export default new CommunicationManager();