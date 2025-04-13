import Comm from '../../utils/comm.js';

Page({
    data: {
      id: '',
      ssid: '',
      password: '',
      listener: null,
      timeout: 0,
    },

    async onLoad(options) {
      this.setData({
          id: {
            deviceId: options.deviceId,
            mac: options.mac,
          }
      });
    },

    onUnload() {
    },

    /** 返回控制界面 */
    backToControl() {
        wx.navigateBack();
    },

    /** 发送 WiFi 信息 */
    async setWiFi() {
      const { id, ssid, password } = this.data;
      try {
        Comm.QaA({
          id,
          time: 15000,
          prepare: async () => {
            wx.showLoading({
              title: '正在配网',
              mask: true
            });
            await Comm.sendMessage(id, JSON.stringify({ ssid }));
            await Comm.sendMessage(id, JSON.stringify({ pw: password }));
            await Comm.sendMessage(id, JSON.stringify({ type: "try" }));
          },
          success: (message) => {
            this.handleReceivedMessage(message);
          },
          fail: async () => {
            wx.hideLoading();
            wx.showToast({
              title: '配网超时',
              icon: 'none'
            });
          }
        })
      } catch (error) {
        wx.hideLoading();
        wx.showToast({
          title: '配网失败',
          icon: 'none'
        });
        console.error('配网错误:', error);
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
          }
          else if (parsedMessage.wifi == 'false') {
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