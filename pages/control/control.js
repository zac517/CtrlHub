// pages/control/control.js
import CommunicationManager from '../../utils/communicationManager'

Page({
  data: {
      name: '',
      deviceId: '',
      isOpen: false,
      isWiFiOpen: false,
      mode: 0,
      modeLabel: ['均衡', '夜间', '专注', '自动'],
      brightValue: 30 ,
    
      buttons: [
        {
          name: 'power',
          type: 'tap',
          label: '',
          isPressed: false,
          bindtap: 'onPowerTap',
        },
        {
          name: 'brightness',
          type: 'drag',
          label: '亮度',
          isPressed: false,
        },
        {
          name: 'color',
          type: 'drag',
          label: '色温',
          isPressed: false,
        },
        {
          name: 'mode',
          type: 'tap',
          label: '模式',
          isPressed: false,
          bindtap: 'onModeTap',
        },
        {
          name: 'wifi',
          type: 'tap',
          label: 'WiFi',
          isPressed: false,
          bindtap: 'onWiFiTap',
        },
        {
          name: 'config',
          type: 'tap',
          label: '配网',
          isPressed: false,
          bindtap: 'onConfigTap',
        },
      ],
      commManager: null,
  },
  
  brighttouch(e){
      console.log(e.changedTouches[0].screenX)
      this.setData({
          brightValue: (e.changedTouches[0].screenX-109)/2.6
      });
  },

  onTouchStart(e) {
    let index = e.target.dataset.index;
    let newButton = {...this.data.buttons[index], isPressed: true};
    let newButtons = [...this.data.buttons];
    newButtons[index] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onTouchEnd(e) {
    let index = e.target.dataset.index;
    let newButton = {...this.data.buttons[index], isPressed: false};
    let newButtons = [...this.data.buttons];
    newButtons[index] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onPowerTap() {
    if (this.data.isOpen) {
      this.setData({
        isOpen: false,
      });
    }
    else {
      this.setData({
        isOpen: true,
      });
    }
  },

  onWiFiTap() {
    if (this.data.isWiFiOpen) {
      this.setData({
        isWiFiOpen: false,
      });
    }
    else {
      this.setData({
        isWiFiOpen: true,
      });
    }
  },

  onModeTap() {
    if (this.data.mode == 3) {
      this.setData({
        mode: 0,
      });
    }
    else {
      this.setData({
        mode: this.data.mode + 1,
      });
    }
  },

  // 返回函数
  backToHome() {
    wx.redirectTo({
        url: '/pages/home/home',
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.setData({
      name: options.name,
      deviceId: options.deviceId,
    });

    this.data.commManager = new CommunicationManager();
    this.data.commManager.init();

    let commManager = this.data.commManager;
    let deviceId = this.data.deviceId;

    commManager.connect(deviceId)
      .then(connectionType => {
        console.log(`连接成功，通过 ${connectionType}`);
        // 发送消息
        commManager.sendMessage(deviceId, { type: 'command', data: 'Hello Device' })
          .then(() => console.log('消息发送成功'))
          .catch(err => console.error('消息发送失败:', err));
      })
      .catch(err => console.error('连接失败:', err));

    // 监听消息
    commManager.onMessageReceived((deviceId, message) => {
      console.log(`收到消息 (${deviceId}):`, message);
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
})