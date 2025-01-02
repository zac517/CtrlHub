Page({
  data: {
    devices: [],  // 存储扫描到的蓝牙设备
    deviceId: '',
    serviceId: '',
    characteristicId: '',
    ssid: '',
    password: '',
    openid: '',
    selectedDeviceId: '',
    title: "选择设备",
    position: "left",
    name: '',
    space: '',
  },

  handleInput: function (event) { 
    const inputType = event.currentTarget.dataset.inputType; // 获取自定义数据属性 
    const inputValue = event.detail.value; // 获取输入的值
    this.setData({
      [inputType]: inputValue, // 使用动态键名更新值
    });
  },

  bufferToString: function (buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
  },

  selectDevice: function (e) { 
    const deviceId = e.currentTarget.dataset.deviceId; 
    this.setData({ 
      selectedDeviceId: deviceId // 更新被选中的设备ID 
    }); 
  },

  // 连接蓝牙设备
  connectDevice: function () {
    wx.showLoading();
    const deviceId = this.data.selectedDeviceId;

    // 连接选中的蓝牙设备
    wx.createBLEConnection({
      deviceId: deviceId,
      success: (res) => {
        console.log('设备连接成功');
        this.setData({
          'deviceId': deviceId,
        })
        // 获取设备服务
        wx.getBLEDeviceServices({
          deviceId, 
          success: (res) => {
            this.setData({
              'serviceId': res.services[0].uuid
            })
            // 获得特征值
            wx.getBLEDeviceCharacteristics({
              deviceId, 
              serviceId: this.data.serviceId, 
              success: (res) => {
                this.setData({
                  'characteristicId': res.characteristics[0].uuid,
                  'position': "center",
                  'title': "基础设置"
                })
                
              }
            })
          }
        })
        wx.hideLoading();
      },
      fail: function (err) {
        wx.hideLoading();
        wx.showToast({
          title: '连接失败',
          icon: 'none'
        });
      }
    });
  },

  onLoad: function () {
    wx.cloud.init();
    // 读取openid值
    this.setData({
      'openid': wx.getStorageSync('openid')
    });
    // 搜索蓝牙设备
    this.startScan();
  },

  startScan: function () {
    // 开始扫描蓝牙设备
    wx.openBluetoothAdapter({
      success: () => {
        console.log('蓝牙适配器初始化成功');
        wx.startBluetoothDevicesDiscovery({
          success: (res) => {
            console.log('开始扫描');
            // 扫描到设备后监听
            wx.onBluetoothDeviceFound( (devices) => {
              // 借助公司标识检测是否为所需设备
              let decodedString = this.bufferToString(devices.devices[0].advertisData);
              if (decodedString == "Luminalink") {
                this.setData({
                  devices: [...this.data.devices, devices.devices[0]]
                }) // 更新设备列表
              }
            });
          },
          fail: function (err) {
            wx.showToast({
              title: '启动蓝牙扫描失败',
              icon: 'none'
            });
          }
        });
      },
      fail: function (err) {
        wx.showToast({
          title: '请开启手机蓝牙',
          icon: 'none'
        });
      }
    });
  },

  backTo: function() {
    if (this.data.position == "right") {
      this.setData({
        'position': "center",
        'title': "基础设置"
      });
    }
    else if (this.data.position == "center") {
      this.setData({
        'position': "left",
        'title': "选择设备"
      });
      wx.closeBLEConnection({
        deviceId: this.data.deviceId,
      });
    }
    else {
      this.animate('.container', [
        { opacity: 1.0},
        { opacity: 0.0},
        ], 100, function () {
          wx.redirectTo({
            url: '/pages/home/home' 
          });
      }.bind(this))
    }
  },

  // String转Hex
  stringToBytes(str) {
    var array = new Uint8Array(str.length);
    for (var i = 0, l = str.length; i < l; i++) {
      array[i] = str.charCodeAt(i);
    }
    return array.buffer;
  },

  onUnload: function () {
    wx.closeBluetoothAdapter({ 
      success: function (res) { 
        console.log('蓝牙适配器已关闭'); 
      }
    }); 
  },

  setWiFi() {
    wx.showLoading();
    let buffer = this.stringToBytes(this.data.ssid + ';' + this.data.password + ';' +  this.data.openid);
    console.log("开始发送指令");

    // 写入数据
    setTimeout( () => {
      wx.writeBLECharacteristicValue({
        characteristicId: this.data.characteristicId,
        deviceId: this.data.deviceId,
        serviceId: this.data.serviceId,
        value: buffer
      });
    }, 100);

    wx.notifyBLECharacteristicValueChange({
      characteristicId: this.data.characteristicId,
      deviceId: this.data.deviceId,
      serviceId: this.data.serviceId,
      state: true,
      success:(res) => {
        // 监听数据
        wx.onBLECharacteristicValueChange((res) => {
          let result = this.bufferToString(res.value);
          if (result == "true") {
            wx.closeBluetoothAdapter({
              success: (res) => {
                console.log("已关闭蓝牙");
              },
            })
            
            wx.cloud.callFunction({
              name: 'add',
              data: {
                deviceId: this.data.deviceId,
                openid: this.data.openid,
                name: this.data.name,
                space: this.data.space
              },
              success: res => {
                wx.hideLoading();
                wx.showToast({
                  title: '设备添加成功',
                  icon: 'success'
                });
                setTimeout(() => {
                  wx.redirectTo({
                    url: '/pages/home/home',
                  })
                }, 1000);
              }
            })
          }
          else {
            wx.hideLoading();
            wx.showToast({
              title: '无法连接至WiFi',
              icon: 'error'
            });
          }
        })
      }
    });
  },

  centerNext() {
    if (!this.data.name || !this.data.space) {
      wx.showToast({
        title: '请填写内容',
        icon: 'error'
      });
    }else{
      this.setData({
        'position': "right",
        'title': "网络设置"
      })
    }
  },
});