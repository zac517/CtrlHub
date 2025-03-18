import CommunicationManager from '../../utils/communicationManager';

Page({
    data: {
        deviceId: '',
        ssid: '',
        password: ''
    },

    async onLoad(options) {
        this.setData({
            deviceId: options.deviceId,
        });
    },

    onUnload() {
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
        const listener = (id, msg) => {
          try {
            const msgObject = JSON.parse(msg);
            if (id === deviceId && msgObject?.wifi === 'true') {
              clearTimeout(timeout);
              CommunicationManager.messageListeners.delete(listener);
              wx.hideLoading();
              wx.showModal({
                title: '配网完成',
                showCancel: false,
                success: (res) => {
                  wx.navigateBack();
                }
              });
            } else if (id === deviceId && msgObject?.wifi === 'false') {
              clearTimeout(timeout);
              CommunicationManager.messageListeners.delete(listener);
              wx.hideLoading();
              wx.showToast({
                title: '配网失败',
                icon: 'none'
              });
            }
          } catch (err) {
            console.error('消息解析失败:', err);
          }
        };
    
        CommunicationManager.messageListeners.add(listener);
        console.log('监听器已添加，当前监听器数量:', CommunicationManager.messageListeners.size);
    
        await CommunicationManager.sendMessage(deviceId, JSON.stringify({ ssid }));
        await CommunicationManager.sendMessage(deviceId, JSON.stringify({ pw: password }));
        await CommunicationManager.sendMessage(deviceId, JSON.stringify({ type: "try" }));
    
        const timeout = setTimeout(() => {
          CommunicationManager.messageListeners.delete(listener);
          wx.hideLoading();
          wx.showToast({
            title: '配网超时',
            icon: 'none'
          });
        }, 15000); // 10秒超时
      } catch (error) {
        wx.hideLoading();
        wx.showToast({
          title: '配网失败',
          icon: 'none'
        });
        console.error('配网错误:', error);
      }
    }
});