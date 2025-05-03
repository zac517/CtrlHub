import Paho from "./paho-mqtt-min.js";

class MQTTManager {
  constructor() {
    this.listeners = new Set();
    this.state = false;
    this.connectedDevices = new Set();
    this.client = null;


    this.config = {
      uri: 'wss://broker-cn.emqx.io:8084/mqtt',
      topicPrefix: 'Lumina',
      connect: {
        maxTryTime: 5000,
      },

    }

    this.connectOptions = {
      useSSL: true,
      timeout: 10,
      cleanSession: true,
      keepAliveInterval: 5,
      reconnect: false,
      mqttVersion: 4,
      onSuccess: () => {
        this.state = true;
        this.listeners.forEach(listener => {
          if (listener.onStateChange) listener.onStateChange(true);
        });
      },
    }

    this.init();
  }

  /** 初始化函数 */
  init() {
    const uri = this.config.uri;
    const host = uri.split('://')[1].split(':')[0];
    const port = Number(uri.includes(':') ? uri.split(':')[2].split('/')[0] : 8084);

    this.client = new Paho.Client(host, port, 'wx_' + Date.now());


    wx.onNetworkStatusChange((res) => {
      if (res.isConnected) this.client.connect(this.connectOptions);
    })

    this.client.onConnectionLost = (err) => {
      this.listeners.forEach(listener => {
        if (listener.onConnectionChange) this.connectedDevices.forEach(mac => listener.onConnectionChange(mac, false));
      });
      this.connectedDevices.clear();
      this.state = false;
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(false);
      });
    };

    this.client.onMessageArrived = msg => {
      const topic = msg.destinationName;
      const mac = topic.split('/').slice(-2)[0];
      this.listeners.forEach(listener => {
        if (msg.payloadString == "Device disconnected unexpectedly") {
          this.connectedDevices.delete(mac);
          if (listener.onConnectionChange) listener.onConnectionChange(mac, false);
        } else if (msg.payloadString == "pong") {
          this.connectedDevices.add(mac);
          if (listener.onConnectionChange) listener.onConnectionChange(mac, true);
        } else if (listener.onMessageReceived) listener.onMessageReceived(mac, msg.payloadString);
      });
    };

    this.client.connect(this.connectOptions);
  }

  /** 连接设备 */
  async connect(mac, config) {
    this.config.connect = {
      ...this.config.connect,
      ...config
    };

    const topic = `${this.config.topicPrefix}/devices/${mac}/state`;
    this.client.subscribe(topic, {
      qos: 2
    });
    this.sendMessage(mac, "ping");

    await new Promise((resolve, reject) => {
      const intervalId = setInterval(() => {
        if (this.connectedDevices.has(mac)) {
          clearInterval(intervalId);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(intervalId);
        reject(new Error("MQTT 连接设备超时"));
      }, this.config.connect.maxTryTime);
    });
  }

  /** 断开连接 */
  disconnect(mac) {
    const topic = `${this.config.topicPrefix}/devices/${mac}/state`;
    this.client.unsubscribe(topic);
    this.connectedDevices.delete(mac);
    this.listeners.forEach(listener => {
      if (listener.onConnectionChange) listener.onConnectionChange(mac, false);
    });
  }

  /** 发送消息 */
  sendMessage(mac, message) {
    const topic = `${this.config.topicPrefix}/devices/${mac}/control`;
    const mqttMessage = new Paho.Message(message);
    mqttMessage.destinationName = topic;
    mqttMessage.qos = 2;
    mqttMessage.retained = false;
    mqttMessage.contentType = 'application/json';
    this.client.send(mqttMessage);
  }

}

export default new MQTTManager();