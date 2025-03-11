import BluetoothManager from '../../utils/bluetoothManager';
import { generateRandomValues } from '../../utils/util';

Page({
  data: {
    bluetoothAvailable: false,
    devices: [],
    selectedDevice: null,
    newName: '',
    devicesBuffer: [],
    bluetoothManager: null,
  },

  onLoad() {
    this.init();
  },

  onUnload() {
    this.data.bluetoothManager.closeBluetooth();
  },

  async init() {
    const deviceInfo = wx.getDeviceInfo();
    const platform = deviceInfo.platform;
    console.log("当前平台为 " + platform);

    if (platform !== 'devtools') {
      console.log(this.data.bluetoothManager);
      this.data.bluetoothManager = new BluetoothManager();
      await this.data.bluetoothManager.initBluetooth({
        deviceChange: this.updateDevices.bind(this),
        adapterChange: this.updateAdapter.bind(this),
        onAdapterRecovery: () => this.data.bluetoothManager.startDiscovery(),
      });
    }
  },

  // 返回制造商页面
  backToManu() {
    wx.redirectTo({
      url: '/pages/manufacturer/manufacturer',
    });
  },

  // 更新设备列表
  updateDevices(devices) {
    this.setData({
      devices,
    });
  },

  // 更新蓝牙适配器状态
  updateAdapter(state) {
    this.setData({
      bluetoothAvailable: state.available,
    });
  },

  // 选择设备
  onSelectDevice(e) {
    const device = this.data.devicesBuffer[e.detail.value];
    if (!device) return;
    this.setData({
      selectedDevice: device,
    });
  },

  // 点击选择器
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

  // 添加设备
  async addDevices() {
    let savedDevices = wx.getStorageSync('devices') || []; // 确保初始值是一个数组
    const newDevice = {
      id: await generateRandomValues(),
      name: this.data.newName || this.data.selectedDevice.name,
      deviceId: this.data.selectedDevice.deviceId,
      manufacturer: this.data.bluetoothManager.bufferToString(this.data.selectedDevice.advertisData),
      isOnline: true,
      isSelected: false,
    };
    savedDevices = [newDevice, ...savedDevices];
    wx.setStorageSync('devices', savedDevices);
    wx.redirectTo({
      url: '/pages/home/home',
    });
  },
});