import BLE from '../../utils/BLE.js';

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
        onDeviceChange: devices => {
          if (devices.length > 0) wx.hideLoading();
          this.setData({ devices })
        },
        onStateChange: state => this.setData({ bluetoothAvailable: state.available }),
    };
    BLE.listeners.add(this.data.listener);
    wx.showLoading({
      title: '正在搜索',
      mask: true,
    })
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
    console.log(mac);
    const newDevice = {
        deviceId: this.data.selectedDevice.deviceId,
        mac,
        name: this.data.enteredName || this.data.selectedDevice.name,
        manufacturer,
        isSelected: false,
    };

    let savedDevices = wx.getStorageSync('devices') || [];
    let deviceIndex = -1;

    // 查找是否存在相同 MAC 地址的设备
    for (let i = 0; i < savedDevices.length; i++) {
        if (savedDevices[i].mac === mac) {
            deviceIndex = i;
            break;
        }
    }

    if (deviceIndex!== -1) {
        // 如果存在相同 MAC 地址的设备，覆盖原信息
        savedDevices[deviceIndex] = newDevice;
    } else {
        // 如果不存在，添加新设备
        savedDevices = [newDevice, ...savedDevices];
    }

    wx.setStorageSync('devices', savedDevices);
    wx.navigateBack({
        delta: 2,
    });
  }
});