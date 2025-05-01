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
      onStateRecovery: () => this.connectedDevices.keys().forEach( mac => BLE.connect(this.convert(mac)) ),
      onStateChange: state => {
        this._state.bluetooth = state;
        const lastState = this.state;
        this.state = this._state.bluetooth || this._state.mqtt;
        if (lastState != this.state) {
          this.listeners.forEach(listener => {
            if (listener.onStateChange) listener.onStateChange(this.state);
            if (this.state && listener.onStateRecovery) listener.onStateRecovery();
          });
        }
      },
      onConnectionChange: (deviceId, connected) => {
        const mac = this.convert(deviceId);
        let status = this._connectedDevices.get(mac) || { bluetooth: false, mqtt: false };
        status = { ...status, bluetooth: connected };
        this._connectedDevices.set(mac, status);
        
        const lastState = this.connectedDevices.get(mac);
        this.connectedDevices.set(mac, status.bluetooth || status.mqtt);

        const state = this.connectedDevices.get(mac);

        if (lastState != state) {
          this.listeners.forEach(listener => {
            if (listener.onConnectionChange) listener.onConnectionChange(mac, state);
          });
        }
      },
      onMessageReceived: (deviceId, message) => {
        const mac = this.convert(deviceId);
        this.listeners.forEach(listener => {
          if (listener.onMessageReceived) listener.onMessageReceived(mac, message);
        });
      },
    }

    this.MQTTListener = {
      onStateRecovery: () => this.connectedDevices.keys().forEach( mac => MQTT.connect(mac) ),
      onStateChange: state => {
        this._state.mqtt = state;
        const lastState = this.state;
        this.state = this._state.bluetooth || this._state.mqtt;
        if (lastState != this.state) {
          this.listeners.forEach(listener => {
            if (listener.onStateChange) listener.onStateChange(this.state);
            if (this.state && listener.onStateRecovery) listener.onStateRecovery();
          });
        }
      },
      onConnectionChange: (mac, connected) => {
        // 修改独立状态
        let status = this._connectedDevices.get(mac) || { bluetooth: false, mqtt: false };
        status = { ...status, mqtt: connected };
        this._connectedDevices.set(mac, status);
        
        // 记录旧状态 修改总状态
        const lastState = this.connectedDevices.get(mac);
        this.connectedDevices.set(mac, status.bluetooth || status.mqtt);

        const state = this.connectedDevices.get(mac);

        // 如果状态变化
        if (lastState != state) {
          this.listeners.forEach(listener => {
            if (listener.onConnectionChange) listener.onConnectionChange(mac, state);
          });
        }
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

  /** 绑定 id */
  bind(mac, deviceId) {
    if (deviceId && mac) {
      this.deviceIdMap.set(deviceId, mac);
      this.macMap.set(mac, deviceId);
    }
    else throw new Error("请提供 deviceId 和 mac 地址");
  }

  /** 转换 id */
  convert(id) {
    if (this.deviceIdMap.has(id)) return this.deviceIdMap.get(id);
    else if (this.macMap.has(id)) return this.macMap.get(id);
    else throw new Error("未找到设备");
  }

  /** 连接设备 */
  async connect(mac) {
    const deviceId = this.convert(mac);
    if(!this.connectedDevices.has(mac)) {
      this.connectedDevices.set(mac, false);
      this._connectedDevices.set(mac, {
        bluetooth: false,
        mqtt: false,
      })
    }
    
    const mqttPromise = MQTT.connect(mac);
    const blePromise = this._state.bluetooth ? BLE.connect(deviceId) : Promise.resolve();
    const [mqttResult, bleResult] = await Promise.all([mqttPromise, blePromise]);

    return mqttResult || bleResult;
  }

  /** 断开连接 */
  async disconnect(mac) {
    const deviceId = this.convert(mac);
    this.connectedDevices.delete(mac);
    this._connectedDevices.delete(mac);
    MQTT.disconnect(mac);
    if (this._state.bluetooth) await BLE.disconnect(deviceId);
  }

  /** 发送消息 */
  async sendMessage(mac, message) {
    const deviceId = this.convert(mac);
    MQTT.sendMessage(mac, message);
    if (this._state.bluetooth) await BLE.sendMessage(deviceId, message);
  }

  /** 发送并判断接收到的信息 */
  async QaA(options) {
    const { mac, success, fail, prepare, time } = options;
    const timeout = setTimeout(() => {
      this.listeners.delete(tempListener);
      fail();
    }, time);
    const tempListener = {
      onMessageReceived: (MAC, message) => {
        if (MAC == mac) {
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