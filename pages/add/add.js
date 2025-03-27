import { BLE } from '../../utils/comm.js';
import { generateRandomValues } from '../../utils/util';

Page({
  data: {
    bluetoothAvailable: false,
    devices: [],
    selectedDevice: null,
    tempDevices: [],
    enteredName: '',
    listener: null,
  },

  async onLoad() {
    this.data.listener = {
        onDeviceChange: devices => this.setData({ devices }),
        onStateChange: state => this.setData({ bluetoothAvailable: state.available }),
    };
    BLE.listeners.add(this.data.listener);

    await BLE.startDiscovery();
  },

  async onUnload() {
    BLE.listeners.delete(this.data.listener);
    await BLE.stopDiscovery();
  },

  /** 返回制造商选择 */ 
  backToManu() {
    wx.navigateBack();
  },

  /** 选择设备 */ 
  onSelectDevice(e) {
    const device = this.data.tempDevices[e.detail.value];
    if (!device) return;
    this.setData({ selectedDevice: device });
  },

  /** 点击选择器 */ 
  onPickerTap() {
    if (this.data.bluetoothAvailable) {
      this.data.tempDevices = [...this.data.devices];
    } else {
      wx.showToast({
        title: '当前蓝牙不可用',
        icon: 'none',
      });
    }
  },

  /** 添加设备 */ 
  async addDevices() {
    let savedDevices = wx.getStorageSync('devices') || [];
    const newDevice = {
      id: await generateRandomValues(),
      name: this.data.enteredName || this.data.selectedDevice.name,
      deviceId: this.data.selectedDevice.deviceId,
      manufacturer: BLE.bufferToString(this.data.selectedDevice.advertisData),
      isOnline: true,
      isSelected: false,
    };
    savedDevices = [newDevice, ...savedDevices];
    wx.setStorageSync('devices', savedDevices);
    wx.navigateBack({
      delta: 2,
    });
  },
});