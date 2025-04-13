import Paho from "./paho-mqtt-min.js";

class MQTTManager {
  constructor() {
    this.listeners = new Set();
    this.config = {
      uri: 'wss://broker-cn.emqx.io:8084/mqtt',
      clientId: 'wx_' + Date.now(),
      topicPrefix: 'Lumina',
    }
    this.connectOptions = {
      useSSL: true,
      timeout: 10,
      cleanSession: true,
      keepAliveInterval: 5,
      reconnect: false,
      mqttVersion: 4,
      onSuccess: () => {
        this.connected = true;
        this.listeners.forEach(listener => {
          if (listener.onStateChange) listener.onStateChange(true);
          if (listener.onStateRecovery) listener.onStateRecovery();
        });
      },
      onFailure: () => this.connected = false,
    }
    this.connected = false;
    
    const uri = this.config.uri;
    const host = uri.split('://')[1].split(':')[0];
    const port = Number(uri.includes(':') ? uri.split(':')[2].split('/')[0] : 8084);

    this.client = new Paho.Client(host, port, this.config.clientId);
    this.client.connect(this.connectOptions);

    wx.onNetworkStatusChange((res) => {
      if (res.isConnected) this.client.connect(this.connectOptions);
    })

    this.client.onConnectionLost = () => {
      this.connected = false;
      this.listeners.forEach(listener => {
        if (listener.onStateChange) listener.onStateChange(false);
      });
    };

    this.client.onMessageArrived = msg => {
      const topic = msg.destinationName;
      const mac = topic.split('/').slice(-2)[0];
      this.listeners.forEach(listener => {
        if (msg.payloadString == "Device disconnected unexpectedly") {
          if (listener.onConnectionChange) listener.onConnectionChange(mac, false);
        }
        else if (listener.onMessageReceived) listener.onMessageReceived(mac, msg.payloadString);
      });
    };
  }

  /** 订阅设备 */
  subscribe(mac, config) {
    this.config = { ...this.config, ...config };
    const topic = `${this.config.topicPrefix}/devices/${mac}/state`;
    this.client.subscribe(topic, { qos: 2 });
    this.listeners.forEach(listener => {
      if (listener.onConnectionChange) listener.onConnectionChange(mac, true);
    });
  }

  /** 取消订阅设备 */
  unsubscribe(mac) {
    const topic = `${this.config.topicPrefix}/devices/${mac}/state`;
    this.client.unsubscribe(topic);
    this.listeners.forEach(listener => {
      if (listener.onConnectionChange) listener.onConnectionChange(mac, false);
    });
  }

  /** 发送消息 */
  publish(mac, message) {
    const topic = `${this.config.topicPrefix}/devices/${mac}/control`;
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

export default new MQTTManager();