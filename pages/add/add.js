import bluetoothManager from '../../utils/bluetoothManager'
import { generateRandomValues } from '../../utils/util'

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

  onSelectDevice(e) {
    wx.showLoading({
      title: '获取中',
    })
    const device = this.data.devices[e.detail.value];
    if (!device) return;

    bluetoothManager.connectAndDiscoverServices({
      deviceId: device.deviceId,
      success: ({ service }) => {
        this.setData({
          selectedDevice: {
            ...device,
            serviceUUID: service.uuid
          }
        });
        wx.hideLoading();
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ 
          title: err.type === 'TIMEOUT' ? '操作超时' : '获取服务失败',
          icon: 'none'
        });
      }
    });
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

  async addDevices() {
    let savedDevices = wx.getStorageSync('devices');
    const newDevice = {
      id: await generateRandomValues(),
      name: this.data.newName || this.data.selectedDevice.name,
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