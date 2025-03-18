import BluetoothManager from './bluetoothManager.js';
import MqttManager from './mqttManager.js';

class CommunicationManager {
  constructor() {
    this.deviceStatus = new Map();

    /**状态 */
    this.state = {
      bluetooth: { available: false, discovering: false },
      mqtt: false,
    };

    this.BLEtask = {
      callbacks: {
        onStateChange: state => {
          if (!this.state.bluetooth.available) {
            this.tasks.forEach(task => {
              if (task.recover) task.recover();
            });
          };
          this.state.bluetooth = state;
          this.tasks.forEach(task => {
            if (task.callbacks.onStateChange) task.callbacks.onStateChange(this.state);
          })
        },
        onConnectionChange: res => {
          const { deviceId, connected } = res;
          const deviceStatus = this.deviceStatus.get(deviceId);
          this.deviceStatus.set(deviceId, { ...deviceStatus, bluetooth: connected });
          this.tasks.forEach(task => {
            if (task.callbacks.onConnectionChange) task.callbacks.onConnectionChange(deviceId, this.deviceStatus.get(deviceId));
          })
        },
        onMessageReceived: (deviceId, message) => {
          this.tasks.forEach(task => {
            if (task.callbacks.onMessageReceived) task.callbacks.onMessageReceived(deviceId, message);
          })
        },
      },
    }

    this.MQTTtask = {
      callbacks: {
        onStateChange: state => {
          if (!this.state.mqtt) {
            this.tasks.forEach(task => {
              if (task.recover) task.recover();
            });
          };
          this.state.mqtt = state;
          this.tasks.forEach(task => {
            if (task.callbacks.onStateChange) task.callbacks.onStateChange(this.state);
          })
        },
        onMessageReceived: (deviceId, message) => {
          this.tasks.forEach(task => {
            if (task.callbacks.onMessageReceived) task.callbacks.onMessageReceived(deviceId, message);
          })
        },
      }
    }

    this.tasks = new Set();

    BluetoothManager.begin(this.BLEtask);
    MqttManager.begin(this.MQTTtask);
  }

  /**初始化并开始任务函数 */
  begin(task) {
    this.tasks.add(task);
    if (task.setup) task.setup();
  }

  /**结束任务函数 */
  finish(task) {
    if (task.end) task.end();
    this.tasks.delete(task);
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
    let currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus?.bluetooth) {
      try {
        await BluetoothManager.disconnect(deviceId);
      }
      catch {};
    }

    currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus?.mqtt) {
      MqttManager.unsubscribe(deviceId);
      this.deviceStatus.set(deviceId, { ...currentStatus, mqtt: false });
    }
  }

  /** 发送消息 */
  async sendMessage(deviceId, message) {
    const status = this.deviceStatus.get(deviceId);
    if (status?.bluetooth) {
      return await BluetoothManager.sendMessage(deviceId, message);
    } else if (status?.mqtt) {
      return MqttManager.publish(deviceId, message);
    } else {
      throw new Error('设备离线');
    }
  }
}

export default new CommunicationManager();