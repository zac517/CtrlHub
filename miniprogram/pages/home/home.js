import mqtt from '../../utils/mqtt.js';

Page({
  data: {
    openid: '',
    devices: [],
    userInfo: {},
    mqttClient: null,
  },

  onLoad() {
    wx.cloud.init();
    // 读取openid
    this.setData({
      'openid': wx.getStorageSync('openid'),
      'userInfo': wx.getStorageSync('userInfo'),
      'devices': wx.getStorageSync('devices')
    });

    if (!this.data.openid) {
      wx.redirectTo({
        url: '/pages/login/login' 
      });
    }
    else {
      // 调用云函数获取设备数据
      this.getDevices();

      // 初始化MQTT客户端
      this.initMqttClient();
    }
  },

  switchChange(e) {
    let deviceId = e.currentTarget.dataset.deviceId;
    let deviceChecked = e.detail.value;

    for (let device of this.data.devices) {
      if (device.deviceId == deviceId) {
        device.checked = deviceChecked;
      }
    }

    this.setData({ 'devices': this.data.devices });
    wx.setStorageSync('devices', this.data.devices);

    // 发送MQTT命令
    this.sendMqttCommand(deviceId, deviceChecked);
  },

  onAddClick() {
    this.animate('.container', [
      { opacity: 1.0 },
      { opacity: 0.0 },
    ], 100, function () {
      wx.redirectTo({
        url: '/pages/add/add' 
      });
    }.bind(this))
  },

  getDevices: function () {
    wx.cloud.callFunction({
      name: 'getDevicesByOpenid',
      data: {
        openid: this.data.openid
      },
      success: res => {
        if (res.result.success) {
          const existingDevices = this.data.devices || [];
  
          this.setData({
            devices: res.result.data.map(device => {
              const existingDevice = existingDevices.find(d => d.deviceId === device.deviceId);
              return { ...device, checked: existingDevice ? existingDevice.checked : false };
            })
          });

          wx.setStorageSync('devices', this.data.devices);
  
          console.log('Devices:', res.result.data);
        } else {
          console.error('Failed to get devices:', res.result.message);
        }
      },
      fail: err => {
        console.error('Failed to call cloud function:', err);
      }
    });
  },
  

  // 初始化MQTT客户端
  initMqttClient() {
    const mqttClient = mqtt.connect('wxs://broker.emqx.io:8084/mqtt', {
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 4000,
    }); 
    mqttClient.on('connect', () => {
      console.log('MQTT连接成功');
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT连接失败:', err);
    });

    this.setData({ mqttClient });
  },

  // 发送MQTT命令
  sendMqttCommand(deviceId, deviceChecked) {
    const { mqttClient, openid } = this.data;
    if (!mqttClient) {
      console.error('MQTT客户端未初始化');
      return;
    }

    const command = {
      openid: openid,
      deviceId: deviceId,
      command: deviceChecked ? 'on' : 'off',
    };

    mqttClient.publish(`devices/Zac/${openid}/${deviceId}/commands`, JSON.stringify(command), (err) => {
      if (err) {
        console.error('MQTT命令发送失败:', err);
      } else {
        console.log('MQTT命令发送成功:', command);
      }
    });
  }
});
