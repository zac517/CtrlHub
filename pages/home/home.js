// pages/home/home.js
import { isBluetoothAdapterOpened } from "../../utils/comm.js"

Page({
  /**
   * 页面的初始数据
   */
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
      selectedCount: 0
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

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})