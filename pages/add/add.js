import BLE from '../../utils/BLE.js';

Page({
  data: {
    listener: null,
    state: false,
    devices: [],
    selectedDevice: null,
    tempDevices: [],
    enteredName: '',
  },

  async onLoad() {
    // 准备监听器
    this.data.listener = {
        onStateRecovery: async () => {
          await wx.showLoading({
            title: '正在搜索',
            mask: true,
          })
          await BLE.startDiscovery()
        },
        onDeviceChange: devices => {
          if (devices.length > 0) wx.hideLoading();
          this.setData({ devices });
        },
        onStateChange: state => this.setData({ state }),
    };
    BLE.listeners.add(this.data.listener);

    // 同步初始值
    this.setData({ state: BLE.state});

    // 初始操作
    if (this.data.state) {
      await wx.showLoading({
        title: '正在搜索',
        mask: true,
      })
      await BLE.startDiscovery()
    };
  },

  async onUnload() {
    BLE.listeners.delete(this.data.listener);
    if (this.data.state) await BLE.stopDiscovery();
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
    if (this.data.state) {
      this.data.tempDevices = [...this.data.devices];
    } else {
      wx.showToast({
        title: '当前蓝牙不可用',
        icon: 'none',
      });
    }
  },

  parseMacAddress(manufacturerData) {
    if (manufacturerData?.length === 8) {
        const macBytes = manufacturerData.slice(2);
        const macAddressArray = [];
        for (let i = 0; i < macBytes.length; i++) {
            let byte = macBytes[i];
            if (typeof byte!== 'number') byte = Number(byte);
            const hex = byte.toString(16).padStart(2, '0');
            macAddressArray.push(hex);
        }
        const macAddress = macAddressArray.join(':');
        return macAddress;
    }
    return null;
  },

  /** 添加设备 */ 
  async addDevices() {
    const dataArray = new Uint8Array(this.data.selectedDevice.advertisData);
    let manufacturer = '';
    let mac = '';
    if (dataArray[0] === 0xFF && dataArray[1] === 0xFE) {
        manufacturer = "Lumina";
        mac = this.parseMacAddress(dataArray);
    } else {
        manufacturer = "Unknown";
        mac = this.data.selectedDevice.deviceId.toLowerCase();
    }

    const newDevice = {
        mac,
        deviceId: this.data.selectedDevice.deviceId,
        name: this.data.enteredName || this.data.selectedDevice.name,
        manufacturer,
        isSelected: false,
    };

    let savedDevices = wx.getStorageSync('devices') || [];
    let deviceIndex = -1;

    for (let i = 0; i < savedDevices.length; i++) {
        if (savedDevices[i].mac === mac) {
            deviceIndex = i;
            break;
        }
    }

    if (deviceIndex!== -1) savedDevices[deviceIndex] = newDevice;
    else savedDevices = [newDevice, ...savedDevices];

    wx.setStorageSync('devices', savedDevices);
    wx.navigateBack({ delta: 2 });
  }
});