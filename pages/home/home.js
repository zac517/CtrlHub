import CommunicationManager from '../../utils/communicationManager'
Page({
  data: {
    devices: [],
    isOnSelect: false,
    isSelectedAll: false,
    selectedCount: 0,
    isOnDiscovery: false,

    state: {
      bluetooth: { available: false, discovering: false },
      mqtt: false,
    },

    available: false,

    task: null,
  },

  onLoad() {
    this.setData({
      devices: wx.getStorageSync('devices') || [],
    });
    this.cancelSelectAll();
    this.data.task = {
      callbacks: {
        onStateChange: state => {
          this.setData({
           state,
           available: state.bluetooth.available || state.mqtt,
          })
        },
      },
    };
    CommunicationManager.begin(this.data.task);
  },

  onHide() {
    wx.setStorageSync('devices', this.data.devices);
  },

  onShow() {
    this.setData({
      devices: wx.getStorageSync('devices') || [],
    });
  },

  onUnload() {
    wx.setStorageSync('devices', this.data.devices);
    CommunicationManager.finish(this.data.task);
  },

  /**
   * 开始选择函数
   */
  startSelect(e) {
    this.setData({
      isOnSelect: true,
    });
  },

  /**
   * 全选函数
   */
  selectAll() {
    const devices = this.data.devices.map(device => ({
      ...device,
      isSelected: true,
    }));
    const selectedCount = devices.length;
    this.setData({
      devices,
      selectedCount,
      isSelectedAll: true,
    });
  },

  /**
   * 取消全选函数
   */
  cancelSelectAll() {
    if (this.data.devices) {
      const devices = this.data.devices.map(device => ({
        ...device,
        isSelected: false,
      }));
      this.setData({
        devices,
        selectedCount: 0,
        isSelectedAll: false,
      });
    }
  },

  /**
   * 取消选择函数
   */
  cancelSelect() {
    this.cancelSelectAll();
    this.setData({
      isOnSelect: false,
    });
  },

  /**
   * 删除选中设备的函数
   */
  deleteSelected() {
    if (this.data.selectedCount > 0) {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除选中的设备吗？',
        success: (res) => {
          if (res.confirm) {
            const devices = this.data.devices.filter(device =>!device.isSelected);
            const selectedCount = 0;
            this.setData({
              devices,
              selectedCount,
              isSelectedAll: false,
            });
            this.cancelSelect();
          }
        },
      });
    }
  },

  /**
   * 处理选中事件函数
   */
  handleCheckboxChange(e) {
    const selectedDevice = e.currentTarget.dataset.device;
    const devices = this.data.devices;
    const newDevices = [...devices];
    let isSelectedAll = true;
    let selectedCount = 0;

    newDevices.forEach((device) => {
      if (device.id === selectedDevice.id) {
        device.isSelected =!device.isSelected;
      }
      if (device.isSelected) {
        selectedCount++;
      } else {
        isSelectedAll = false;
      }
    });

    this.setData({
      devices: newDevices,
      selectedCount,
      isSelectedAll,
    });
  },

  /**
   * 卡片长按事件函数
   */
  cardLongpress(e) {
    wx.vibrateShort({
      type: "heavy",
      success: () => {
        if (!this.data.isOnSelect) {
          this.startSelect();
        }
        this.handleCheckboxChange(e);
      },
    });
  },

  /**
   * 卡牌点击事件函数
   */
  cardTap(e) {
    if (this.data.isOnSelect) {
      this.handleCheckboxChange(e);
    } else {
      if (!this.data.available) {
        wx.showToast({
          title: '请先开启 WiFi 或蓝牙',
          icon: 'none'
        });
      }
      else {
        if (e.currentTarget.dataset.device.manufacturer == "Lumina") {
          wx.navigateTo({
            url: `/pages/control/control?name=${e.currentTarget.dataset.device.name}&deviceId=${e.currentTarget.dataset.device.deviceId}`,
          });
        }
        else {
          wx.showToast({
            title: '暂不支持控制此类设备',
            icon: 'none'
          });
        }
      }
    }
  },

  /**
   * 重命名函数
   */
  renameDevice() {
    const selectedDevice = this.data.devices.find(device => device.isSelected);
    if (selectedDevice) {
      wx.showModal({
        title: '重命名设备',
        placeholderText: selectedDevice.name,
        editable: true,
        success: (res) => {
          if (res.confirm) {
            const newName = res.content;
            if (newName) {
              const newDevices = this.data.devices.map(device => {
                if (device.id === selectedDevice.id) {
                  return {
                    ...device,
                    name: newName,
                  };
                }
                return device;
              });
              this.setData({
                devices: newDevices,
              });
              this.cancelSelect();
            }
          }
        },
      });
    }
  },

  /**
   * 跳转到设备选择函数
   */
  selectManufacturer() {
    wx.navigateTo({
      url: `/pages/manufacturer/manufacturer?devices=${this.data.devices}`,
    });
  },
});