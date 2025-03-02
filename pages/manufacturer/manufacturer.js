// pages/manufacturer/manufacturer.js
Page({
    data: {
    },

    // 返回函数
    backToHome() {
        wx.redirectTo({
            url: '/pages/home/home',
        });
    },

    goToAdd() {
        wx.redirectTo({
            url: '/pages/add/add',
        });
    },
});