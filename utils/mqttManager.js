// mqttManager.js
import Paho from "./paho-mqtt-min.js";

class MqttManager {
  constructor(config) {
    this.client = null;
    this.connected = false;
    this.messageListeners = new Set();
    this.connectionListeners = new Set();
    this.topicPrefix = 'Lumina'; // 默认主题前缀

    this.config =  {
      /**测试模式 */
      testMode: true,
      /**默认 WebSocket 地址 */
      uris: 'wss://broker-cn.emqx.io:8084/mqtt',
      /**连接超时时间（秒） */ 
      timeout: 10,
      /**持久会话 */ 
      cleanSession: false,                      
      /**心跳间隔 */
      keepAliveInterval: 5,                     
      /**自动重连 */
      reconnect: true,                          
      /**MQTT 3.1.1 版本 */
      mqttVersion: 4,                           
      onSuccess: () => {
        this.connected = true;
        this.connectionListeners.forEach(cb => cb(true));
      },
      onFailure: () => {
        this.connected = false;
        this.connectionListeners.forEach(cb => cb(false));
      }
    }
  }

  // 初始化并连接
  connect(options = {}) {
    // 默认配置
    const config =
    };

    // 合并用户提供的配置
    const { uris, clientId, topicPrefix, ...restOptions } = options;
    const connectOptions = { ...config, ...restOptions };

    // 设置主题前缀（如果提供了新值）
    if (topicPrefix) {
      this.topicPrefix = topicPrefix;
    }

    // 确保 uris 存在
    if (uris) {
      connectOptions.uris = uris;
    }

    // 创建 Paho MQTT 客户端
    // 从 uris 中解析主机名和端口（仅用于 Paho.Client 的构造函数）
    try {
      const uri = connectOptions.uris[0];
      const host = uri.split('://')[1].split(':')[0];
      const port = Number(uri.includes(':') ? uri.split(':')[2].split('/')[0] : 8084);

      // 创建客户端，clientId 作为第三个参数传递，而不是在 connectOptions 中
      this.client = new Paho.Client(host, port, clientId || `wx_${Date.now()}`);
    } catch (e) {
      console.error('创建 MQTT 客户端失败，检查 uris 配置:', e);
      throw e;
    }

    // 连接
    this.client.connect(connectOptions);

    // 设置断连和消息到达的监听
    this.client.onConnectionLost = () => {
      this.connected = false;
      this._notifyConnectionState(false);
    };

    this.client.onMessageArrived = msg => {
      try {
        const jsonData = JSON.parse(msg.payloadString);
        // 从主题中提取 deviceId，假设主题格式为 `${topicPrefix}/devices/{deviceId}`
        const deviceId = msg.destinationName.split('/').pop();
        this.messageListeners.forEach(cb => cb(deviceId, jsonData));
      } catch (e) {
        console.error('MQTT消息解析失败:', e);
      }
    };
  }

  // 订阅
  subscribe(deviceId) {
    if (!this.connected) return;
    const topic = `${this.topicPrefix}/devices/${deviceId}`;
    this.client.subscribe(topic, { qos: 2 });
  }

  // 发送消息
  publish(deviceId, message) {
    if (!this.connected) return Promise.reject('MQTT未连接');
    const topic = `${this.topicPrefix}/devices/${deviceId}`;
    const mqttMessage = new Paho.Message(message);
    mqttMessage.destinationName = topic;
    mqttMessage.qos = 2;
    mqttMessage.retained = false;
    mqttMessage.contentType = 'application/json';
    this.client.send(mqttMessage);
    return Promise.resolve();
  }

  // 监听消息
  onMessageReceived(callback) {
    if (typeof callback === 'function') this.messageListeners.add(callback);
  }

  // 监听连接状态
  onConnectionStateChanged(callback) {
    if (typeof callback === 'function') this.connectionListeners.add(callback);
  }

  // 断开连接
  disconnect() {
    if (this.client && this.connected) {
      this.client.disconnect();
      this.connected = false;
    }
  }
}

/**MQTT模块 */
const mqttManager = new MqttManager();
export default mqttManager;