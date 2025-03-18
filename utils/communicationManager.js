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
  }

  /**初始化并开始任务函数 */
  begin(options) {
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
}

export default new CommunicationManager();