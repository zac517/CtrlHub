import bluetoothManager from '../../utils/bluetoothManager'
import { generateRandomValues } from '../../utils/util'

Page({
  data: {
    bluetoothAvailable: false,
    devices: [],
    selectedDevice: null,
    newName: '',
    devicesBuffer: [],
  },

  // 这里没有拼写错
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
        deviceCallbacks: [this.updateDevices.bind(this),],
        adapterCallbacks: [this.updateAdapter.bind(this),],
      });
      bluetoothManager.startDiscovery();
    };
  },

  updateDevices(devices) {
    this.setData({
      devices,
    });
  },

  updateAdapter(state) {
    this.setData({
      bluetoothAvailable: state.available,
    })
  },

  onSelectDevice(e) {
    const device = this.data.devicesBuffer[e.detail.value];
    if (!device) return;
    this.setData({
      selectedDevice: device,
    });
  },

  onPickerTap() {
    // 点击时将现在的列表保存下来 以防选择时列表更新导致选不到预期的设备
    if (this.data.bluetoothAvailable) {
      this.data.devicesBuffer = [...this.data.devices];
    }
    else {
      wx.showToast({
        title: '当前蓝牙不可用',
        icon: 'none'
      });
    }
  },

  bufferToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
  },

  async addDevices() {
    let savedDevices = wx.getStorageSync('devices');
    const newDevice = {
      id: await generateRandomValues(),
      name: this.data.newName || this.data.selectedDevice.name,
      deviceId: this.data.selectedDevice.deviceId,
      manufacturer: this.bufferToString(this.data.selectedDevice.advertisData),
      isOnline: true,
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