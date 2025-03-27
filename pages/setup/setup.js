import { Comm } from '../../utils/comm.js';

Page({
    data: {
      deviceId: '',
      ssid: '',
      password: '',
      listener: null,
      timeout: 0,
    },

    async onLoad(options) {
      this.setData({
          deviceId: options.deviceId,
      });
      this.listener = {
        onMessageReceived: (deviceId, message) => {
          this.handleReceivedMessage(deviceId, message);
        },
      }
      Comm.listeners.add(this.listener);
    },

    onUnload() {
      Comm.listeners.delete(this.listener);
    },

    /**返回控制界面 */
    backToControl() {
        wx.navigateBack();
    },

    /**发送 WiFi 信息 */
    async setWiFi() {
      const { deviceId, ssid, password } = this.data;
      wx.showLoading({
        title: '正在配网',
        mask: true
      });
    
      try {
        await Comm.sendMessage(deviceId, JSON.stringify({ ssid }));
        await Comm.sendMessage(deviceId, JSON.stringify({ pw: password }));
        await Comm.sendMessage(deviceId, JSON.stringify({ type: "try" }));
        this.data.timeout = setTimeout(() => {
          wx.hideLoading();
          wx.showToast({
            title: '配网超时',
            icon: 'none'
          });
        }, 15000);
      } catch (error) {
        wx.hideLoading();
        wx.showToast({
          title: '配网失败',
          icon: 'none'
        });
        console.error('配网错误:', error);
      }
    },

    handleReceivedMessage(deviceId, message) {
      if (deviceId == this.data.deviceId) {
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
    }
});