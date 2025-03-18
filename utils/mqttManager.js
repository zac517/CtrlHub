import Paho from "./paho-mqtt-min.js";

class MqttManager {
  constructor(config) {
    /**配置 */
    this.config = {
      /**测试模式 */
      testMode: true,
      /**默认 WebSocket 地址 */
      uri: 'wss://broker-cn.emqx.io:8084/mqtt',
      /**客户端 ID */ 
      clientId: 'wx_' + Date.now(),
      /**主题前缀 */
      topicPrefix: 'Lumina',

      /**连接配置 */
      connectOptions: {
        useSSL: true,
        timeout: 10,
        cleanSession: false,
        keepAliveInterval: 5,
        reconnect: true,
        mqttVersion: 4, 
        onSuccess: () => {
          this.connected = true;
          if (this.config.testMode) console.log('连接 MQTT 服务器成功');
          this.stateListeners.forEach(cb => cb(true));
          if (this.task?.recover) this.task.recover();
        },
        onFailure: () => {
          console.log('连接 MQTT 服务器失败')
          this.connected = false;
        }
      }
    }

    this.config = { ...this.config, ...config };
    if (this.config.testMode) console.log('MQTT 模块初始化');

    this.stateListeners = new Set();
    this.messageListeners = new Set();

    /**任务 */
    this.task = null;
    /**mqtt 客户端 */
    this.client = null;
    /**服务器连接状态 */
    this.connected = false;
    
    this.init();
  }

  /**初始化并连接 */
  init() {
    if (this.config.testMode) console.log('尝试连接MQTT服务器');
    // 创建 Paho MQTT 客户端
    const uri = this.config.uri;
    const host = uri.split('://')[1].split(':')[0];
    const port = Number(uri.includes(':') ? uri.split(':')[2].split('/')[0] : 8084);
    const clientId = this.config.clientId;
    const connectOptions = this.config.connectOptions;
    this.topicPrefix = this.config.topicPrefix;
    try {
      this.client = new Paho.Client(host, port, clientId);
    } catch (e) {
      console.error('创建 MQTT 客户端失败: ', e);
      throw e;
    }

    // 连接
    this.client.connect(connectOptions);

    // 断连监听
    this.client.onConnectionLost = () => {
      this.connected = false;
      this.stateListeners.forEach(cb => cb(false));
    };

    // 消息监听
    this.client.onMessageArrived = msg => {
      const topic = msg.destinationName;
      const deviceId = topic.split('/').slice(-2)[0];
      if (this.config.testMode) console.log('收到消息: ', deviceId, msg.payloadString);
      this.messageListeners.forEach(cb => cb(deviceId, msg.payloadString));
    };
  }

  /**初始化并开始任务函数 */
  begin(options) {
    if (this.connected) {
      this.task = options.task;
      console.log(options.onMessageReceived);
      this._registerCallbacks(options.onStateChange, this.stateListeners);
      this._registerCallbacks(options.onMessageReceived, this.messageListeners);
      if (this.task?.setup) this.task.setup();
    }
    else {
      console.log('MQTT未连接');
    }
  }

  /**结束任务函数 */
  finish() {
    if (this._checkLevels(0)) {
      if (this.task?.end) this.task.end();
      this.task = null;
      this.stateListeners.clear();
      this.messageListeners.clear();
    }
  }

  /**订阅设备 */
  subscribe(deviceId) {
    if (this.connected) {
      const topic = `${this.topicPrefix}/devices/${deviceId.toLowerCase()}/state`;
      this.client.subscribe(topic, { qos: 2 });
    }
    else {
      console.log('MQTT未连接');
    }
  }

  /**取消订阅设备 */
  unsubscribe(deviceId) {
    if (this.connected) {
      const topic = `${this.topicPrefix}/devices/${deviceId.toLowerCase()}/state`;
      this.client.unsubscribe(topic);
    }
    else {
      console.log('MQTT未连接');
    }
  }

  /**发送消息 */
  publish(deviceId, message) {
    if (this.connected) {
      const topic = `${this.topicPrefix}/devices/${deviceId.toLowerCase()}/control`;
      const mqttMessage = new Paho.Message(message);
      mqttMessage.destinationName = topic;
      mqttMessage.qos = 2;
      mqttMessage.retained = false;
      mqttMessage.contentType = 'application/json';
      this.client.send(mqttMessage);
    }
    else {
      console.log('MQTT未连接');
    }
  }

  /** 断开连接 */
  disconnect() {
    if (this.client && this.connected) {
      this.client.disconnect();
      this.connected = false;
    }
    else {
      console.log('MQTT未连接');
    }
  }

  /**注册回调，支持列表或单个函数 */
  _registerCallbacks(callbacks, listenerSet) {
    if (Array.isArray(callbacks)) {
      callbacks.forEach(cb => {
        if (typeof cb === 'function') listenerSet.add(cb);
      });
    } else if (typeof callbacks === 'function') {
      listenerSet.add(callbacks);
    }
  }
}

/**MQTT模块 */
const mqttManager = new MqttManager();
export default mqttManager;