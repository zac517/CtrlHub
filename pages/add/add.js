import bluetoothManager from '../../utils/bluetoothManager'

Page({
  data: {
    bluetoothAvailable: false,
    devices: [],
    selectedDevice: null,
    newName: '',
  },

  // 返回制造商选择函数
  backToManu() {
    wx.redirectTo({
      url: '/pages/manufacturer/manufacturer',
    });
  },

  onLoad(options) {
    this.startBlE();
  },

  startBlE() {
    const deviceInfo = wx.getDeviceInfo();
    const platform = deviceInfo.platform;
    console.log("当前平台为 " + platform);

    if (platform !== 'devtools') {
      bluetoothManager.initBluetooth({
        callbacks: [this.updateDevices.bind(this),],
      });
      bluetoothManager.startDiscovery();
    };
  },

  updateDevices(devices) {
    this.setData({
      devices,
      bluetoothAvailable: bluetoothManager.adapterState.available,
    });
  },

  // picker选择
  onSelectDevice(e) {
    console.log(this.data.devices);
    this.setData({
      selectedDevice: this.data.devices[e.detail.value],
    });
  },

  async onSelectDevice(e) {
    if (!this.data.devices.length) return;
    
    const device = this.data.devices[e.detail.value];
    if (!device) return;
    this.setData({
      newName: device.name,
    })
    try {
      // 连接设备
      await bluetoothManager.connectDevice(device.deviceId);
      
      // 获取服务列表
      const services = await bluetoothManager.getDeviceServices(device.deviceId);
      
      // 获取主服务UUID（示例取第一个服务）
      const primaryService = services[0]?.uuid;
      if (!primaryService) throw new Error('未找到可用服务');

      // 记录到选中设备信息中
      this.setData({
        selectedDevice: {
          ...device,
          serviceUUID: primaryService
        }
      });
      
      console.log('成功获取主服务 UUID:', primaryService);
    } catch (error) {
      console.error('连接过程出错:', error);
      wx.showToast({ title: '获取服务失败', icon: 'none' });
    } finally {
      // 无论成功与否都断开连接
      await bluetoothManager.disconnectDevice(device.deviceId);
    }
  },

  onInputChange(e) {
    this.setData({
      selectedDevice: {...this.data.selectedDevice, name: e.detail.value},
    });
  },

  onPickerTap() {
    wx.showToast({
      title: '当前蓝牙不可用',
      icon: 'none'
    });
  },

  addDevices() {
    let savedDevices = wx.getStorageSync('devices');
    const newDevice = {
      name: this.data.newName,
      deviceId: this.data.selectedDevice.deviceId,
      UUID: this.data.selectedDevice.serviceUUID,
      isOnline: false,
      isSelected: false
    };
    savedDevices = [newDevice, ...savedDevices];
    wx.setStorageSync('devices', savedDevices);
    wx.redirectTo({
      url: '/pages/home/home',
    });
  },

  onUnload() {
    bluetoothManager.closeBluetooth();
  },
})