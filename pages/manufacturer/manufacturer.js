Page({
  backToHome() {
    wx.navigateBack();
  },

  goToAdd() {
    wx.navigateTo({
      url: '/pages/add/add'
    });
  },
});