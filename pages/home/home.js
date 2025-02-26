// pages/home/home.js
import { isBluetoothAdapterOpened } from "../../utils/comm.js"

Page({
  data: {
    devices: [
      {
        name: "台灯1",
        deviceId: "AAAA",
        UUID: "AAAA",
        isOnline: false,
        isSelected: false,
      },
      {
        name: "台灯2",
        deviceId: "BBBB",
        UUID: "BBBB",
        isOnline: true,
        isSelected: false,
      },
      {
        name: "台灯3",
        deviceId: "CCCC",
        UUID: "CCCC",
        isOnline: true,
        isSelected: false,
      },
    ],
    isOnSelect: false,
    isSelectedAll: false,
    selectedCount: 0,
  },

  test() {
    console.log("设备列表随机测试");
    // 随机生成 0 到 12 之间的设备数量
    const deviceCount = Math.floor(Math.random() * 13);
    const newDevices = [];
    for (let i = 0; i < deviceCount; i++) {
        const device = {
            // 按规律生成设备名称
            name: `台灯${i + 1}`,
            // 按规律生成设备 ID 和 UUID
            deviceId: String.fromCharCode(65 + Math.floor(i / 26)).repeat(4),
            UUID: String.fromCharCode(65 + Math.floor(i / 26)).repeat(4),
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

  startSelect() {
    console.log("开始选择");
    const devices = this.data.devices.map(device => ({
      ...device,
      isSelected: false
    }));
    this.setData({
      devices,
      isOnSelect: true,
      isSelectedAll: false,
      selectedCount: 0
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
    const devices = this.data.devices.filter(device =>!device.isSelected);
    const selectedCount = 0;
    this.setData({
      devices,
      selectedCount,
      isSelectedAll: false,
    });
  },

  // 处理选中事件函数
  handleCheckboxChange(e) {
    const index = e.currentTarget.dataset.index;
    const devices = this.data.devices;
    const newDevices = [...devices];
    const wasSelected = newDevices[index].isSelected; // 记录之前的选中状态
    console.log('a');

    // 切换当前设备的选中状态
    newDevices[index].isSelected =!wasSelected;

    // 根据状态变化更新选中数量
    let selectedCount = this.data.selectedCount;
    if (wasSelected) {
        // 如果之前是选中状态，现在取消选中，数量减 1
        selectedCount--;
    } else {
        // 如果之前是未选中状态，现在选中，数量加 1
        selectedCount++;
    }
    
    // 根据选中的数量判断是否为全选
    let isSelectedAll = this.data.isSelectedAll;
    if (selectedCount == devices.length) {
      isSelectedAll = true;
    }
    else {
      isSelectedAll = false;
    }

    this.setData({
        devices: newDevices,
        selectedCount,
        isSelectedAll,
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (isBluetoothAdapterOpened()) {
      console.log("a");
    }
    else {
      console.log("b")
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    wx.stopPullDownRefresh({
      success: () => {
        this.test();
      }
    });
  },
})