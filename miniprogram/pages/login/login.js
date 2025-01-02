// pages/login/login.js
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    openid: ''
  },
  login() {
    wx.cloud.init();
    // 登记用户
    wx.cloud.callFunction({
      name: 'login',
      data: {
        nickName: this.data.userInfo.nickName, 
        avatarUrl: this.data.userInfo.avatarUrl
      },
      success: res => {
        wx.setStorageSync('openid', res.result.openid);
        this.setData({
          'openid': res.result.openid
        })
        console.log("获取openid成功");

        this.animate('.container', [
          { opacity: 1.0},
          { opacity: 0.0},
          ], 100, function () {
            wx.redirectTo({
              url: '/pages/home/home' 
            });
        }.bind(this));
      }
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const { nickName } = this.data.userInfo;
    this.setData({
      "userInfo.avatarUrl": avatarUrl,
    });
    wx.setStorageSync('userInfo', {avatarUrl: avatarUrl, nickName: nickName});
    if (avatarUrl && nickName) {
      // 如果用户设置了头像和昵称，则跳转到其他页面
      this.login();
    }
  },

  onInputChange(e) {
    const nickName = e.detail.value;
    const { avatarUrl } = this.data.userInfo;
    this.setData({
      "userInfo.nickName": nickName,
    });
    wx.setStorageSync('userInfo', {avatarUrl: avatarUrl, nickName: nickName});
    if (avatarUrl && nickName) {
      // 如果用户设置了头像和昵称，则跳转到其他页面
      this.login();
    }
  },


  onLoad() {
    // 读取本地缓存
    this.setData({
      'openid': wx.getStorageSync('openid')
    })
    if (this.data.openid) {
      // 如果用户设置了头像和昵称，则跳转到其他页面
      wx.redirectTo({
        url: '/pages/home/home' 
      });
    }
  }
})