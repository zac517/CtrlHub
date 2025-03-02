Page({
  data: {
      devices: [],
      isOnSelect: false,
      isSelectedAll: false,
      selectedCount: 0,
  },

  test() {
      // 随机生成 0 到 12 之间的设备数量
      const deviceCount = Math.floor(Math.random() * 13);
      const newDevices = [];
      for (let i = 0; i < deviceCount; i++) {
          const device = {
              // 按规律生成设备名称
              name: `台灯${i + 1}`,
              // 按规律生成设备 ID 和 UUID
              deviceId: String.fromCharCode(65 + i).repeat(4),
              UUID: String.fromCharCode(65 + i).repeat(4),
              // 随机赋值 isOnline
              isOnline: Math.random() > 0.5,
              // 新增参数，表示设备是否被选中，默认值为 false
              isSelected: false
          };
          newDevices.push(device);
      }
      // 更新 data 中的 devices 列表
      this.setData({
          devices: newDevices,
          isOnSelect: false,
          isSelectedAll: false,
          selectedCount: 0,
      });
  },

  // 开始选择函数
  startSelect(e) {
      console.log("开始选择");
      const devices = this.data.devices.map(device => ({
          ...device,
          isSelected: false
      }));
      this.setData({
          devices,
          isOnSelect: true,
          isSelectedAll: false,
          selectedCount: 0,
      });
  },

  // 全选函数
  selectAll() {
      const devices = this.data.devices.map(device => ({
          ...device,
          isSelected: true
      }));
      const selectedCount = devices.length;
      this.setData({
          devices,
          selectedCount,
          isSelectedAll: true,
      });
  },

  // 取消全选函数
  cancelSelectAll() {
      const devices = this.data.devices.map(device => ({
          ...device,
          isSelected: false
      }));
      this.setData({
          devices,
          selectedCount: 0,
          isSelectedAll: false,
      });
  },

  // 取消选择函数
  cancelSelect() {
      this.setData({
          isOnSelect: false,
      });
  },

  // 删除选中设备的函数
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
                  }
              }
          });
      }
  },

  // 处理选中事件函数
  handleCheckboxChange(e) {
      const selectedDevice = e.currentTarget.dataset.device;
      const devices = this.data.devices;
      const newDevices = [...devices];
      let isSelectedAll = true;
      let selectedCount = 0;

      // 遍历设备列表，更新每个设备的选中状态
      newDevices.forEach((device) => {
          if (device.deviceId === selectedDevice.deviceId) {
              // 找到当前点击的设备，切换其选中状态
              device.isSelected = !device.isSelected;
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
          isSelectedAll
      });
  },

  // 卡片长按事件函数
  cardLongpress(e) {
      wx.vibrateShort({
          type: "light",
          success: () => {
              if (!this.data.isOnSelect) {
                  this.startSelect();
              }
              this.handleCheckboxChange(e);
          }
      });
  },

  // 卡牌点击事件函数
  cardTap(e) {
    if (this.data.isOnSelect) {
      this.handleCheckboxChange(e);
    }
    else {
      wx.redirectTo({
        url: '/pages/control/control',
      })

    }
  },

  // 重命名函数
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
                              if (device.deviceId === selectedDevice.deviceId) {
                                  return {
                                      ...device,
                                      name: newName
                                  };
                              }
                              return device;
                          });
                          this.setData({
                              devices: newDevices
                          });
                      }
                  }
              }
          });
      }
  },

  // 跳转到设备选择函数
  selectManufacturer() {
      wx.redirectTo({
          url: `/pages/manufacturer/manufacturer?devices=${this.data.devices}`,
      });
  },

  onLoad(options) {
    this.setData({
      devices: wx.getStorageSync('devices'),
    });
  },

  onHide() {
      console.log("触发");
      wx.setStorageSync('devices', this.data.devices);
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
      wx.setStorageSync('devices', this.data.devices);
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
      wx.stopPullDownRefresh({
          success: () => {
              wx.vibrateShort({
                  type: "light",
                  success: () => {
                      this.test();
                  }
              });
          }
      });
  },
});