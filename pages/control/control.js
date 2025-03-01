// pages/control/control.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
        name:"",
        status:{light:0,mode:0,wifi:false},
        openisPressed:false,
        wifiisPressed:false,
        plusisPressed:false,
        reduceisPressed:false,
        MidisPressed:false,
        HotisPressed:false,
        ColdisPressed:false
    },

  openoff(){
    console.log("点击")
  },

  wificontrol(){
    console.log("点击")
  },

  lightreduce(){

  },

  lightplus(){

  },

  cold(){},
  mid(){},

OnPressStart: function(e) {
    this.setData({
        openisPressed: true
    });
    wx.vibrateShort();
},
OnPressEnd: function(e) {
    this.setData({
        openisPressed: false
    });
    wx.vibrateShort();
},



  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
      
        // const configurename = JSON.parse(decodeURIComponent(options.name));
        // console.log("复杂数据：", configurename);
        // this.setData({
        //   name: configurename
        // });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.onload()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})