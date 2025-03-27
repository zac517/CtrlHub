import Paho from "./paho-mqtt-min.js";

class ListenerManager {
  constructor() {
    this.listeners = new Set();
  }
}

class BLEManager extends ListenerManager {
  constructor() {
    super();
    this.platform = wx.getDeviceInfo().platform;

    // 以下为实际的状态
    this.state = { available: false, discovering: false };
    this.foundDevices = new Map();
    this.connectedDevices = new Map();

    // 以下为自动恢复开启时需要恢复的状态 
    this.isDiscovery = false;
    this.isConnect = false;
    this.connectDevicesIds = new Set();

    this.config = {
      discovery: {
        shouldRecover: true,
        scanInterval: 2000,
        rssiThreshold: -80,
      },
      connect: {
        shouldRecover: true,
      }
    };

    this.init();
  }

  /** 初始化函数 */
  async init() {
    try {
      await wx.openBluetoothAdapter();
      this.state = { available: true, discovering: false };
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(this.state);
      })
      if (this.isDiscovery) this.startDiscovery();
      if (this.isConnect) this.connectDevicesIds.forEach(deviceId => this.connect(deviceId));
    } catch (err) {
    }

    wx.onBluetoothAdapterStateChange(res => {
      const lastState = this.state;
      this.state = res;
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(this.state);
      })
      // 自动恢复
      if (!lastState.available && this.state.available) {
        if (this.isDiscovery) this.startDiscovery();
        if (this.isConnect) this.connectDevicesIds.forEach(deviceId => this.connect(deviceId));
      }
    });

    wx.onBluetoothDeviceFound(res => {
      res.devices.forEach(device => {
        if (device.name && device.RSSI > this.config.discovery.rssiThreshold) {
          this.foundDevices.set(device.deviceId, device);
        }
      });
      this.listeners.forEach(listener => {
        if (listener.onDeviceChange) listener.onDeviceChange(Array.from(this.foundDevices.values()));
      })
      this.foundDevices.clear();
    });

    wx.onBLEConnectionStateChange(res => {
      if (!res.connected) this.connectedDevices.delete(res.deviceId);
      this.listeners.forEach(listener => {
        if (listener.onConnectionChange) listener.onConnectionChange(res);
      })
    });

    wx.onBLECharacteristicValueChange(res => {
      this.listeners.forEach(listener => {
        if (listener.onMessageReceived) listener.onMessageReceived(res.deviceId, this.bufferToString(res.value));
      })
    });
  }

  /** 开启扫描 */
  async startDiscovery(config) {
    this.config.discovery = { ...this.config.discovery, ...config };
    if (this.config.discovery.shouldRecover) this.isDiscovery = true;
    if (!this.state.available) return;
    await wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      interval: this.config.discovery.scanInterval,
      powerLevel: 'medium',
    });
  }

  /** 关闭扫描 */
  async stopDiscovery() {
    this.isDiscovery = false;
    if (!this.state.available) return;
    await wx.stopBluetoothDevicesDiscovery();
  }

  /** 连接设备并记录服务和特征值 */
  async connect(deviceId, config) {
    this.config.connect = { ...this.config.connect, ...config };
    if (this.config.connect.shouldRecover) {
      this.isConnect = true;
      this.connectDevicesIds.add(deviceId);
    }
    if (!this.state.available) return;
    try {
      await wx.createBLEConnection({ deviceId });
      this.connectedDevices.set(deviceId, { serviceData: null });
      const serviceData = await this._discoverServicesAndCharacteristics(deviceId);
      this.connectedDevices.get(deviceId).serviceData = serviceData;
      this._onMessageReceived(deviceId, true);
      return true;
    } catch (err) {
      throw err;
    }
  }

  /** 发现服务和特征值 */
  async _discoverServicesAndCharacteristics(deviceId) {
    try {
      const servicesRes = await wx.getBLEDeviceServices({ deviceId });
      const services = servicesRes.services;
      const servicePromises = services.map(async service => {
        const charRes = await wx.getBLEDeviceCharacteristics({ 
          deviceId, 
          serviceId: service.uuid 
        });
        return { 
          serviceId: service.uuid, 
          characteristics: 
          charRes.characteristics 
        };
      });
      return await Promise.all(servicePromises);
    } catch (err) {
      throw err;
    }
  }

  /** 发送消息 */
  async sendMessage(deviceId, message) {
    const device = this.connectedDevices.get(deviceId);
    const service = device.serviceData[0];
    const writableChar = service.characteristics.find(char => char.properties.write || char.properties.writeNoResponse);
    await wx.writeBLECharacteristicValue({
      deviceId,
      serviceId: service.serviceId,
      characteristicId: writableChar.uuid,
      value: this._stringToBuffer(message),
    });
  }

  /** 修改消息接收通知 */
  async _onMessageReceived(deviceId, state) {
    const device = this.connectedDevices.get(deviceId);
    const service = device.serviceData[0];
    const notifyChar = service.characteristics.find(char => char.properties.notify || char.properties.indicate);
    await wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId: service.serviceId,
      characteristicId: notifyChar.uuid,
      state,
    });
  }

  /** 断开连接 */
  async disconnect(deviceId) {
    this.connectDevicesIds.delete(deviceId);
    if (this.connectDevicesIds.size == 0) this.isConnect = false;
    if (!this.state.available) return;
    try {
      await this._onMessageReceived(deviceId, false);
      await wx.closeBLEConnection({ deviceId });
      return true;
    } catch (err) {
      throw err;
    }
  }

  /** 将字符串转化为ArrayBuffer */
  _stringToBuffer(str) {
    var array = new Uint8Array(str.length);
    for (var i = 0, l = str.length; i < l; i++) {
      array[i] = str.charCodeAt(i);
    }
    return array.buffer;
  }

  /** 将ArrayBuffer转化为字符串 */
  bufferToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer))
  }
}

class MQTTManager extends ListenerManager {
  constructor() {
    super();
    this.config = {
      uri: 'wss://broker-cn.emqx.io:8084/mqtt',
      clientId: 'wx_' + Date.now(),
      topicPrefix: 'Lumina',
      
      connectOptions: {
        useSSL: true,
        timeout: 10,
        cleanSession: false,
        keepAliveInterval: 5,
        reconnect: true,
        mqttVersion: 4,
        onSuccess: () => {
          this.connected = true;
          this.listeners.forEach(listener => {
            if (listener.onStateChange) listener.onStateChange(true);
          });
        },
        onFailure: () => this.connected = false,
      }
    }

    this.client = null;
    this.connected = false;
    
    const uri = this.config.uri;
    const host = uri.split('://')[1].split(':')[0];
    const port = Number(uri.includes(':') ? uri.split(':')[2].split('/')[0] : 8084);
    const clientId = this.config.clientId;
    const connectOptions = this.config.connectOptions;
    this.topicPrefix = this.config.topicPrefix;

    this.client = new Paho.Client(host, port, clientId);
    this.client.connect(connectOptions);

    this.client.onConnectionLost = () => {
      this.connected = false;
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(false);
      });
    };

    this.client.onMessageArrived = msg => {
      const topic = msg.destinationName;
      const deviceId = topic.split('/').slice(-2)[0].toUpperCase();
      this.listeners.forEach(listener => {
        if (listener.onMessageReceived) listener.onMessageReceived(deviceId, msg.payloadString);
      });
    };
  }

  /** 订阅设备 */
  subscribe(deviceId) {
    const topic = `${this.topicPrefix}/devices/${deviceId.toLowerCase()}/state`;
    this.client.subscribe(topic, { qos: 2 });
  }

  /** 取消订阅设备 */
  unsubscribe(deviceId) {
    const topic = `${this.topicPrefix}/devices/${deviceId.toLowerCase()}/state`;
    this.client.unsubscribe(topic);
  }

  /** 发送消息 */
  publish(deviceId, message) {
    const topic = `${this.topicPrefix}/devices/${deviceId.toLowerCase()}/control`;
    const mqttMessage = new Paho.Message(message);
    mqttMessage.destinationName = topic;
    mqttMessage.qos = 2;
    mqttMessage.retained = false;
    mqttMessage.contentType = 'application/json';
    this.client.send(mqttMessage);
  }

  /** 断开连接 */
  disconnect() {
    this.client.disconnect();
    this.connected = false;
  }
}

class CommManager extends ListenerManager {
  constructor() {
    super();

    // 以下为实际的状态
    this.state = {
      bluetooth: { available: false, discovering: false },
      mqtt: false,
    };
    this.deviceStatus = new Map();

    // 以下为自动恢复开启时需要恢复的状态
    this.isConnect = false;
    this.connectDevicesIds = new Set();

    this.config = {
      connect: {
        shouldRecover: true,
      }
    };

    this.BLE = new BLEManager();
    this.MQTT = new MQTTManager();

    this.BLEListener = {
      onStateChange: state => {
        this.state.bluetooth = state;
        this.listeners.forEach(listener => {
          if (listener.onStateChange) listener.onStateChange(this.state);
        });
      },
      onConnectionChange: res => {
        const { deviceId, connected } = res;
        const deviceStatus = this.deviceStatus.get(deviceId);
        this.deviceStatus.set(deviceId, { ...deviceStatus, bluetooth: connected });
        this.listeners.forEach(listener => {
          if (listener.onConnectionChange) listener.onConnectionChange(res);
        });
      },
      onMessageReceived: (deviceId, message) => {
        this.listeners.forEach(listener => {
          if (listener.onMessageReceived) listener.onMessageReceived(deviceId, message);
        });
      },
    }

    this.MQTTListener = {
      onStateChange: state => {
        this.state.mqtt = state;
        this.listeners.forEach(listener => {
          if (listener.onStateChange) listener.onStateChange(this.state);
        });
      },
      onMessageReceived: (deviceId, message) => {
        this.listeners.forEach(listener => {
          if (listener.onMessageReceived) listener.onMessageReceived(deviceId, message);
        });
      },
    }

    this.BLE.listeners.add(this.BLEListener);
    this.MQTT.listeners.add(this.MQTTListener);
  }

  /** 连接设备 */
  async connect(deviceId) {
    let currentStatus = this.deviceStatus.get(deviceId);
    if (!currentStatus?.bluetooth) {
      await this.BLE.connect(deviceId);
    }

    currentStatus = this.deviceStatus.get(deviceId);
    if (!currentStatus?.mqtt) {
      this.MQTT.subscribe(deviceId);
      this.deviceStatus.set(deviceId, { ...currentStatus, mqtt: true });
    }
  }

  /** 断开连接 */
  async disconnect(deviceId) {
    let currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus?.bluetooth) await this.BLE.disconnect(deviceId);

    currentStatus = this.deviceStatus.get(deviceId);
    if (currentStatus?.mqtt) {
      this.MQTT.unsubscribe(deviceId);
      this.deviceStatus.set(deviceId, { ...currentStatus, mqtt: false });
    }
  }

  /** 发送消息 */
  async sendMessage(deviceId, message) {
    const status = this.deviceStatus.get(deviceId);
    if (status?.bluetooth) {
      return await this.BLE.sendMessage(deviceId, message);
    } else if (status?.mqtt) {
      return this.MQTT.publish(deviceId, message);
    } else {
      throw new Error('设备离线');
    }
  }

  /** 发送并判断接收到的信息 */
  async wait(options) {
    const { deviceId, success, fail, prepare, time } = options;
    const timeout = setTimeout(() => {
      Comm.listeners.delete(tempListener);
      fail();
    }, time);
    const tempListener = {
      onMessageReceived: (id, message) => {
        if (id === deviceId) {
          console.log(id, deviceId);
          Comm.listeners.delete(tempListener);
          clearTimeout(timeout);
          success(message);
        }
      },
    };
    Comm.listeners.add(tempListener);
    prepare();
  }
}

const Comm = new CommManager();
const BLE = Comm.BLE;
const MQTT = Comm.MQTT;

export { Comm, BLE, MQTT };