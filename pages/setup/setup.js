import BluetoothManager from '../../utils/bluetoothManager';

Page({
    data: {
        deviceId: '',
        name: '',
        bluetoothManager: null,
        bluetoothAvailable: false,
        ssid: '',
        password: ''
    },

    async onLoad(options) {
        this.setData({
            deviceId: options.deviceId,
            name: options.name,
            bluetoothAvailable: false,
        });
        this.data.bluetoothManager = new BluetoothManager();
        await this.data.bluetoothManager.initBluetooth({
            onAdapterChange: this.updateAdapter.bind(this),
            onAdapterRecovery: () => this.data.bluetoothManager.connect(this.data.deviceId),
            onMessageReceived: this.handleDeviceMessage.bind(this)
        });
        this.data.bluetoothManager.onMessageReceived(options.deviceId);
    },

    onUnload() {
        this.data.bluetoothManager.closeBluetooth();
    },

    /**返回控制界面 */
    backToControl() {
        wx.navigateBack();
    },

    /**更新蓝牙适配器状态 */
    updateAdapter(state) {
        this.setData({
            bluetoothAvailable: state.available
        });
    },

    /**发送 WiFi 信息 */
    async setWiFi() {
        const { deviceId, bluetoothManager, ssid, password } = this.data;

        // 展示加载框
        wx.showLoading({
            title: '正在连接...',
            mask: true
        });

        try {
            // 发送 WiFi 名称
            await bluetoothManager.sendMessage(deviceId, JSON.stringify({ ssid }));
            // 发送 WiFi 密码
            await bluetoothManager.sendMessage(deviceId, JSON.stringify({ pw: password }));
            // 发送尝试连接请求
            await bluetoothManager.sendMessage(deviceId, JSON.stringify({ type: "try" }));
        } catch (error) {
            // 关闭加载框
            wx.hideLoading();
            // 提示无法连接
            wx.showToast({
                title: '无法连接',
                icon: 'none'
            });
        }
    },

    handleDeviceMessage(deviceId, message) {
        try {
            const parsedMessage = JSON.parse(message);
            // 关闭加载框
            wx.hideLoading();

            if (parsedMessage.wifi === "true") {
                // 提示连接成功
                wx.showToast({
                    title: '连接成功',
                    icon: 'success'
                });
                // 等待 1 秒后返回控制界面
                setTimeout(() => {
                    this.backToControl();
                }, 1000);
            } else if (parsedMessage.wifi === "off") {
                // 提示连接失败
                wx.showToast({
                    title: '连接失败',
                    icon: 'none'
                });
            }
        } catch (error) {
            // 提示解析消息失败
            wx.showToast({
                title: '解析消息失败',
                icon: 'none'
            });
        }
    }
});