import Comm from '../../utils/comm.js';

Page({
  data: {
    mac: '',
    ssid: '',
    password: '',
    listener: null,
    timeout: 0,
  },

  async onLoad(options) {
    this.setData({
      mac: options.mac
    });
  },

  onUnload() {},

  /** 返回控制界面 */
  backToControl() {
    wx.navigateBack();
  },

  /** 发送 WiFi 信息 */
  async setWiFi() {
    const {
      mac,
      ssid,
      password
    } = this.data;
    try {
      wx.showLoading({
        title: '正在配网',
        mask: true
      });
      await Comm.sendMessage(mac, JSON.stringify({
        ssid
      }));
      await Comm.sendMessage(mac, JSON.stringify({
        pw: password
      }));
      await Comm.sendMessage(mac, JSON.stringify({
        type: "try"
      }));
      const message = await Comm.wait(mac, 5000);
      this.handleReceivedMessage(message);
    } catch (err) {
      console.error(err);
      wx.hideLoading();
      if (err.message == "等待超时") {
        wx.showToast({
          title: '配网超时',
          icon: 'none'
        });
      } else {
        wx.showToast({
          title: '配网失败',
          icon: 'none'
        });
      }
    }
  },

  handleReceivedMessage(message) {
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.wifi) {
        if (parsedMessage.wifi == 'true') {
          clearTimeout(this.data.timeout);
          wx.hideLoading();
          wx.showModal({
            title: '配网完成',
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
        } else if (parsedMessage.wifi == 'false') {
          clearTimeout(this.data.timeout);
          wx.hideLoading();
          wx.showToast({
            title: '配网失败',
            icon: 'none'
          });
        }
      }
    } catch (err) {
      console.error('解析消息失败:', err);
    }
  }
});