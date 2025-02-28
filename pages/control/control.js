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

openOnPressStart: function(e) {
    this.setData({
        openisPressed: true
    });
},
openOnPressEnd: function(e) {
    this.setData({
        openisPressed: false
    });
},

wifiOnPressStart: function(e) {
    this.setData({
        wifiisPressed: true
    });
},
wifiOnPressEnd: function(e) {
    this.setData({
        wifiisPressed: false
    });
},

reduceOnPressStart: function(e) {
    this.setData({
        reduceisPressed: true
    });
},
reduceOnPressEnd: function(e) {
    this.setData({
        reduceisPressed: false
    });
},

plusOnPressStart: function(e) {
    this.setData({
        plusisPressed: true
    });
},
plusOnPressEnd: function(e) {
    this.setData({
        plusisPressed: false
    });
},

ColdOnPressStart: function(e) {
    this.setData({
        ColdisPressed: true
    });
},
ColdOnPressEnd: function(e) {
    this.setData({
        ColdisPressed: false
    });
},

MidOnPressStart: function(e) {
    this.setData({
        MidisPressed: true
    });
},
MidOnPressEnd: function(e) {
    this.setData({
        MidisPressed: false
    });
},

HotOnPressStart: function(e) {
    this.setData({
        HotisPressed: true
    });
},
HotOnPressEnd: function(e) {
    this.setData({
        HotisPressed: false
    });
},

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
      
        const configurename = JSON.parse(decodeURIComponent(options.name));
        console.log("复杂数据：", configurename);
        this.setData({
          name: configurename
        });
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