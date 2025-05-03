import BLE from "./BLE.js"
import MQTT from "./MQTT.js"

class CommManager {
  constructor() {
    this.listeners = new Set();

    this.state = false;
    this._state = {
      bluetooth: false,
      mqtt: false,
    };

    this.connectedDevices = new Map();
    this._connectedDevices = new Map();

    this.deviceIdMap = new Map();
    this.macMap = new Map();

    this.init();
  }

  /** 初始化函数 */
  init() {
    this._state.bluetooth = BLE.state;
    this._state.mqtt = MQTT.state;
    this.state = this._state.bluetooth || this._state.mqtt;

    this.BLEListener = {
      onStateChange: state => {
        this._state.bluetooth = state;
        if (this._state.bluetooth) this.connectedDevices.keys().forEach(mac => BLE.connect(this.convert(mac)));
        this._stateChange();
      },
      onConnectionChange: (deviceId, connected) => {
        const mac = this.convert(deviceId);
        let status = this._connectedDevices.get(mac) || {
          bluetooth: false,
          mqtt: false
        };
        status = {
          ...status,
          bluetooth: connected
        };
        this._connectedDevices.set(mac, status);
        this._connectionChange(mac);
      },
      onMessageReceived: (deviceId, message) => {
        const mac = this.convert(deviceId);
        this.listeners.forEach(listener => {
          if (listener.onMessageReceived) listener.onMessageReceived(mac, message);
        });
      },
    }

    this.MQTTListener = {
      onStateChange: state => {
        this._state.mqtt = state;
        if (this._state.mqtt) this.connectedDevices.keys().forEach(mac => MQTT.connect(mac));
        this._stateChange();
      },
      onConnectionChange: (mac, connected) => {
        let status = this._connectedDevices.get(mac) || {
          bluetooth: false,
          mqtt: false
        };
        status = {
          ...status,
          mqtt: connected
        };
        this._connectedDevices.set(mac, status);
        this._connectionChange(mac);
      },
      onMessageReceived: (mac, message) => {
        this.listeners.forEach(listener => {
          if (listener.onMessageReceived) listener.onMessageReceived(mac, message);
        });
      },
    }
    BLE.listeners.add(this.BLEListener);
    MQTT.listeners.add(this.MQTTListener);
  }

  /** 状态变化处理 */
  _stateChange() {
    const lastState = this.state;
    this.state = this._state.bluetooth || this._state.mqtt;
    if (lastState != this.state) {
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(this.state);
      });
    }
  }

  /** 连接状态变化处理 */
  _connectionChange(mac) {
    const lastState = this.connectedDevices.get(mac);
    const status = this._connectedDevices.get(mac);
    this.connectedDevices.set(mac, status.bluetooth || status.mqtt);
    const state = this.connectedDevices.get(mac);

    if (lastState != state) {
      this.listeners.forEach(listener => {
        if (listener.onConnectionChange) listener.onConnectionChange(mac, state);
      });
    }
  }

  /** 绑定 id */
  bind(mac, deviceId) {
    if (deviceId && mac) {
      this.deviceIdMap.set(deviceId, mac);
      this.macMap.set(mac, deviceId);
    } else throw new Error("请提供 deviceId 和 mac 地址");
  }

  /** 转换 id */
  convert(id) {
    if (this.deviceIdMap.has(id)) return this.deviceIdMap.get(id);
    else if (this.macMap.has(id)) return this.macMap.get(id);
    else throw new Error("未找到设备");
  }

  /** 连接设备 */
  async connect(mac) {
    // 连接函数 不需要考虑一种方式有连接一种没有的情况 这部分由监听器实现
    // 连接函数是用于从完全断开到连接的
    const deviceId = this.convert(mac);
    this.connectedDevices.set(mac, false);
    this._connectedDevices.set(mac, {
      bluetooth: false,
      mqtt: false,
    });

    const mqttPromise = this._state.mqtt ? MQTT.connect(mac) : Promise.resolve();
    const blePromise = this._state.bluetooth ? BLE.connect(deviceId) : Promise.resolve();
    if (this._state.bluetooth && this._state.mqtt) await Promise.race([mqttPromise, blePromise]);
    else await Promise.all([mqttPromise, blePromise]);
  }

  /** 断开连接 */
  async disconnect(mac) {
    const deviceId = this.convert(mac);
    const status = this._connectedDevices.get(mac);
    if (status.mqtt) MQTT.disconnect(mac);
    if (status.bluetooth) await BLE.disconnect(deviceId);
    this.connectedDevices.delete(mac);
    this._connectedDevices.delete(mac);
  }

  /** 发送消息 */
  async sendMessage(mac, message) {
    const deviceId = this.convert(mac);
    const status = this._connectedDevices.get(mac);
    if (status.bluetooth) await BLE.sendMessage(deviceId, message);
    else if (status.mqtt) MQTT.sendMessage(mac, message);
  }

  /** 等待消息 */
  async wait(mac, time) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.listeners.delete(tempListener);
        reject(new Error("等待超时"));
      }, time);

      const tempListener = {
        onMessageReceived: (MAC, message) => {
          if (MAC === mac) {
            this.listeners.delete(tempListener);
            clearTimeout(timeoutId);
            resolve(message);
          }
        }
      };
      this.listeners.add(tempListener);
    });
  }
}

export default new CommManager();