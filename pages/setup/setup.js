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

        // 展示加载框
        wx.showLoading({
            title: '正在配网',
            mask: true
        });

        try {
          const listener = (id, msg) => {
            console.log('收到消息' + msg);
            const msgObject = JSON.parse(msg);
            
            if (id === deviceId && msgObject?.wifi === true) {
              clearTimeout(timeout);
              CommunicationManager.messageListeners.delete(listener);
              wx.hideLoading();
              wx.showModal({
                title: '配网完成',
                showCancel: false,  // 隐藏取消按钮
                success: (res) => {
                  wx.navigateBack();
                }
              })
            }
          }
          CommunicationManager.messageListeners.add(listener);
            await CommunicationManager.sendMessage(deviceId, JSON.stringify({ ssid }));
            await CommunicationManager.sendMessage(deviceId, JSON.stringify({ pw: password }));
            await CommunicationManager.sendMessage(deviceId, JSON.stringify({ type: "try" }));

            
            
        } catch (error) {
            // 关闭加载框
            wx.hideLoading();
            // 提示无法连接
            wx.showToast({
                title: '配网失败',
                icon: 'none'
            });
            console.log(error)
        }
    },
});