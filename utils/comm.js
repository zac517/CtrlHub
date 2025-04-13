import BLE from "./BLE.js"
import MQTT from "./MQTT.js"

class CommManager {
  constructor() {
    this.listeners = new Set();
    this.state = {
      bluetooth: { available: false, discovering: false },
      mqtt: false,
    };
    this.deviceStatus = new Map();
    this.deviceIdMap = new Map();
    this.macMap = new Map();

    this.BLEListener = {
      onStateRecovery: () => {
        this.listeners.forEach(listener => {
          if (listener.onStateRecovery) listener.onStateRecovery();
        });
      },
      onStateChange: state => {
        this.state.bluetooth = state;
        this.listeners.forEach(listener => {
          if (listener.onStateChange) listener.onStateChange(this.state);
        });
      },
      onConnectionChange: (deviceId, connected) => {
        const parsedId = this.parse(deviceId);
        const status = this.deviceStatus.get(parsedId.mac) || { bluetooth: false, mqtt: false };
        this.deviceStatus.set(parsedId.mac, { ...status, bluetooth: connected });
        const connectState = this.deviceStatus.get(parsedId.mac);
        this.listeners.forEach(listener => {
          if (listener.onConnectionChange) listener.onConnectionChange(parsedId, connectState);
        });
      },
      onMessageReceived: (deviceId, message) => {
        this.listeners.forEach(listener => {
          if (listener.onMessageReceived) listener.onMessageReceived(this.parse(deviceId), message);
        });
      },
    }

    this.MQTTListener = {
      onStateRecovery: () => {
        this.listeners.forEach(listener => {
          if (listener.onStateRecovery) listener.onStateRecovery();
        });
      },
      onStateChange: state => {
        this.state.mqtt = state;
        this.listeners.forEach(listener => {
          if (listener.onStateChange) listener.onStateChange(this.state);
        });
      },
      onConnectionChange: (mac, connected) => {
        const parsedId = this.parse(mac);
        const status = this.deviceStatus.get(parsedId.mac) || { bluetooth: false, mqtt: false };
        this.deviceStatus.set(parsedId.mac, { ...status, mqtt: connected });
        const connectState = this.deviceStatus.get(parsedId.mac);
        this.listeners.forEach(listener => {
          if (listener.onConnectionChange) listener.onConnectionChange(parsedId, connectState);
        });
      },
      onMessageReceived: (mac, message) => {
        this.listeners.forEach(listener => {
          if (listener.onMessageReceived) listener.onMessageReceived(this.parse(mac) , message);
        });
      },
    }

    BLE.listeners.add(this.BLEListener);
    MQTT.listeners.add(this.MQTTListener);
  }

  /** 解析 id */
  parse(id) {
    if (typeof id === "object") {
      const {deviceId, mac} = id;
      if (deviceId && mac) {
        this.deviceIdMap.set(deviceId, mac);
        this.macMap.set(mac, deviceId);
      }
      else throw new Error("请提供 deviceId 和 mac 地址");
      return id;
    }
    else if (this.deviceIdMap.has(id)) return { deviceId: id, mac: this.deviceIdMap.get(id) };
    else if (this.macMap.has(id)) return { deviceId: this.macMap.get(id), mac: id };
    else throw new Error("未找到设备");
  }

  /** 连接设备 */
  async connect(id) {
    const parsedId = this.parse(id);
    const { deviceId, mac } = parsedId;
    if (!this.deviceStatus.get(parsedId.mac)?.bluetooth) await BLE.connect(deviceId);
    if (!this.deviceStatus.get(parsedId.mac)?.mqtt) MQTT.subscribe(mac);
  }

  /** 断开连接 */
  async disconnect(id) {
    const parsedId = this.parse(id);
    const { deviceId, mac } = parsedId;
    if (this.deviceStatus.get(parsedId.mac)?.bluetooth) await BLE.disconnect(deviceId);
    if (this.deviceStatus.get(parsedId.mac)?.mqtt) MQTT.unsubscribe(mac);
  }

  /** 发送消息 */
  async sendMessage(id, message) {
    const parsedId = this.parse(id);
    const { deviceId, mac } = parsedId;
    const status = this.deviceStatus.get(parsedId.mac);
    if (status?.bluetooth) return await BLE.sendMessage(deviceId, message);
    else if (status?.mqtt) return MQTT.publish(mac, message);
    else throw new Error('设备离线');
  }

  /** 发送并判断接收到的信息 */
  async QaA(options) {
    const { id, success, fail, prepare, time } = options;
    const parsedId = this.parse(id);
    const timeout = setTimeout(() => {
      this.listeners.delete(tempListener);
      fail();
    }, time);
    const tempListener = {
      onMessageReceived: (id, message) => {
        if (id.mac == parsedId.mac) {
          this.listeners.delete(tempListener);
          clearTimeout(timeout);
          success(message);
        }
      },
    };
    this.listeners.add(tempListener);
    prepare();
  }
}

export default new CommManager();