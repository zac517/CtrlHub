// pages/manufacturer/manufacturer.js
Page({
    data: {
    },

    /**返回主页 */ 
    backToHome() {
        wx.navigateBack();
    },

    /**前往添加设备 */
    goToAdd() {
        wx.navigateTo({
            url: '/pages/add/add',
        });
    },
});