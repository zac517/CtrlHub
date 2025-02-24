// pages/home/home.js
import { isBluetoothAdapterOpened } from "../../utils/comm.js"

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isDropdownOpen: false,  // 控制下拉栏显示
    selectedOption: null,   // 当前选中项
    options: ['移除设备'], // 下拉数据
    dropdownAnimation: {},   // 动画对象
    savedData: []  //保存的设备数据
  },

  // 切换下拉栏状态
  toggleDropdown() {
    if (!this.data.isDropdownOpen) {
      // 展开动画
      const animation = wx.createAnimation({
        duration: 300,
        timingFunction: 'ease'
      })
      animation.opacity(1).step()
      this.setData({
        isDropdownOpen: true,
        dropdownAnimation: animation.export()
      })
    } else {
      this.closeDropdown()
    }
  },
  add(){
    this.animate('.container', [
        { opacity: 1.0 },
        { opacity: 0.0 },
      ], 100, function () {
        wx.redirectTo({
          url: '/pages/add/add'
        });
      }.bind(this))
  },
  // 选择选项
  selectOption(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      selectedOption: this.data.options[index]
    })

  },

  // 关闭下拉栏
  closeDropdown() {
    const animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease'
    })
    animation.opacity(0).step()
    this.setData({
      isDropdownOpen: false,
      dropdownAnimation: animation.export()
    })
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