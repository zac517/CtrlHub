import BluetoothManager from '../../utils/bluetoothManager.js';
import { generateRandomValues } from '../../utils/util';

Page({
  data: {
    bluetoothAvailable: false,
    devices: [],
    selectedDevice: null,
    newName: '',
    devicesBuffer: [],
    task: null,
  },

  async onLoad() {
    this.data.task = {
      callbacks: {
        onStateChange: this.updateState.bind(this),
        onDeviceChange: this.updateDevices.bind(this),
      },
      setup: () => BluetoothManager.startDiscovery(),
      recover: () => BluetoothManager.startDiscovery(),
      end: () => BluetoothManager.stopDiscovery(),
    };
    BluetoothManager.begin(this.data.task);
  },

  onUnload() {
    BluetoothManager.finish(this.data.task);
  },

  /**返回制造商选择 */ 
  backToManu() {
    wx.navigateBack();
  },

  /**更新设备列表 */ 
  updateDevices(devices) {
    this.setData({ devices });
  },

  /**更新蓝牙适配器状态 */ 
  updateState(state) {
    this.setData({ bluetoothAvailable: state.available });
  },

  /**选择设备 */ 
  onSelectDevice(e) {
    const device = this.data.devicesBuffer[e.detail.value];
    if (!device) return;
    this.setData({ selectedDevice: device });
  },

  /**点击选择器 */ 
  onPickerTap() {
    if (this.data.bluetoothAvailable) {
      this.data.devicesBuffer = [...this.data.devices];
    } else {
      wx.showToast({
        title: '当前蓝牙不可用',
        icon: 'none',
      });
    }
  },

  /**添加设备 */ 
  async addDevices() {
    let savedDevices = wx.getStorageSync('devices') || []; // 确保初始值是一个数组
    const newDevice = {
      id: await generateRandomValues(),
      name: this.data.newName || this.data.selectedDevice.name,
      deviceId: this.data.selectedDevice.deviceId,
      manufacturer: BluetoothManager.bufferToString(this.data.selectedDevice.advertisData),
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