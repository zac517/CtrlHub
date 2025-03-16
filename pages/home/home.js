import CommunicationManager from '../../utils/communicationManager';

Page({
  data: {
    devices: [],
    isOnSelect: false,
    isSelectedAll: false,
    selectedCount: 0,
    isOnDiscovery: false,
  },

  onLoad() {
    this.setData({
      devices: wx.getStorageSync('devices') || [],
    });
    this.cancelSelectAll();
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
  },

  onPullDownRefresh() {
    wx.vibrateShort({
      type: "light",
      success: () => {
        this.refresh();
      },
    });
  },

  /**
   * 刷新
   */
  async refresh() {
    if (this.data.isOnDiscovery) {
      await wx.stopPullDownRefresh();
      return;
    }
    this.data.isOnDiscovery = true;
    const deviceIds = this.data.devices.map(device => device.deviceId);
    const statusMap = await CommunicationManager.checkMultipleOnlineStatus(deviceIds);
    let newDevices = [...this.data.devices];
    newDevices.forEach(device => device.isOnline = statusMap.get(device.deviceId));
    this.setData({
      devices: newDevices,
    });
    this.data.isOnDiscovery = false;
    await wx.stopPullDownRefresh();
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
      type: "light",
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
      if (e.currentTarget.dataset.device.manufacturer == "Lumina") {
        if (e.currentTarget.dataset.device.isOnline) {
          wx.navigateTo({
            url: `/pages/control/control?name=${e.currentTarget.dataset.device.name}&deviceId=${e.currentTarget.dataset.device.deviceId}`,
          });
        }
        else {
          wx.showToast({
            title: '当前设备已离线',
            icon: 'none',
          });
        }
      } else {
        wx.showToast({
          title: '暂不支持控制此类设备',
          icon: 'none',
        });
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