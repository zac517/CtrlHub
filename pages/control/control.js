// pages/control/control.js
Page({
  data: {
      name: "",
      isOpen: false,
      isWiFiOpen: false,
      mode: 0,
      modeLabel: ['均衡', '夜间', '专注', '自动'],
      buttons: [
        {
          name: 'power',
          type: 'tap',
          label: '',
          isPressed: false,
          bindtap: 'onPowerTap',
        },
        {
          name: 'brightness',
          type: 'drag',
          label: '亮度',
          isPressed: false,
        },
        {
          name: 'color',
          type: 'drag',
          label: '色温',
          isPressed: false,
        },
        {
          name: 'mode',
          type: 'tap',
          label: '模式',
          isPressed: false,
          bindtap: 'onModeTap',
        },
        {
          name: 'wifi',
          type: 'tap',
          label: 'WiFi',
          isPressed: false,
          bindtap: 'onWiFiTap',
        },
        {
          name: 'config',
          type: 'tap',
          label: '配网',
          isPressed: false,
        },
      ]
  },
  
  onTouchStart(e) {
    let index = e.target.dataset.index;
    let newButton = {...this.data.buttons[index], isPressed: true};
    let newButtons = [...this.data.buttons];
    newButtons[index] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onTouchEnd(e) {
    let index = e.target.dataset.index;
    let newButton = {...this.data.buttons[index], isPressed: false};
    let newButtons = [...this.data.buttons];
    newButtons[index] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onPowerTap() {
    if (this.data.isOpen) {
      this.setData({
        isOpen: false,
      });
    }
    else {
      this.setData({
        isOpen: true,
      });
    }
  },

  onWiFiTap() {
    if (this.data.isWiFiOpen) {
      this.setData({
        isWiFiOpen: false,
      });
    }
    else {
      this.setData({
        isWiFiOpen: true,
      });
    }
  },

  onModeTap() {
    if (this.data.mode == 3) {
      this.setData({
        mode: 0,
      });
    }
    else {
      this.setData({
        mode: this.data.mode + 1,
      });
    }
  },


  // 返回函数
  backToHome() {
    wx.redirectTo({
        url: '/pages/home/home',
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.setData({
      name: options.name
    });
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
})