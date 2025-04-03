import Comm from '../../utils/comm.js'
import { mixColors } from '../../utils/util'

Page({
  data: {
    name: '',
    id: null,
    
    isOpen: false,
    brightness: 100,
    color: 0,
    coolColor: '#ffffff',
    warmColor: '#ffddbb',
    realColor: '#ffffff',
    mode: 0,
    modeLabel: ['均衡', '夜间', '专注', '自动'],
    isWiFiOpen: false,
    isWiFiConnected: false,
    dragWidth: 0,
    vibrateShort: false,

    buttons: {
      power : {
        isPressed: false,
        bindTap() {
          const newIsOpen =! this.data.isOpen;
          this.setData({
            isOpen: newIsOpen,
          });
          const message = JSON.stringify({ power: newIsOpen? 'on' : 'off' });
          Comm.sendMessage(this.data.id, message);
        },
      },

      brightness : {
        startX: 0,
        startValue: 0,
        left: 0,
        getValue() {
          return this.data.brightness;
        },
        setValue(brightness) {
          this.setData({
            brightness,
          })
        },
      },

      color : {
        startX: 0,
        startValue: 0,
        left: 0,
        getValue() {
          return this.data.color;
        },
        setValue(color) {
          this.setData({
            color,
            realColor: mixColors(this.data.warmColor, this.data.coolColor, color / 100),
          })
        },
      },

      mode : {
        isPressed: false,
        bindTap() {
          let newMode = this.data.mode;
          if (newMode === 3) {
            newMode = 0;
          } else {
            newMode++;
          }
          this.setData({
            mode: newMode,
          });
          const message =  JSON.stringify({ mode: newMode });
          Comm.sendMessage(this.data.id, message);
        },
      },

      wifi : {
        isPressed: false,
        bindTap() {
          const newIsWiFiOpen = !this.data.isWiFiOpen;
          this.setData({
            isWiFiOpen: newIsWiFiOpen,
          });
          const message = JSON.stringify({ wifi: newIsWiFiOpen? 'on' : 'off' });
          Comm.sendMessage(this.data.id, message);
        },
      },

      config : {
        isPressed: false,
      },
    },

    listener: null,
  },

  async onLoad(options) {
    this.setData({
      name: options.name,
      id: { 
        deviceId: options.deviceId,
        mac: options.mac,
      }
    });
    let id = this.data.id;

    this.data.listener = {
      onStateChange: state => {
        if (!(state.bluetooth.available || state.mqtt)) {
          wx.showModal({
            title: '蓝牙和网络均不可用',
            showCancel: false,
            success: (res) => {
              wx.navigateBack({
                delta: 2,
              })
            }
          });
        }
      },
      onMessageReceived: (id, message) => {
        this.handleReceivedMessage(id, message);
      },
      onConnectionChange: (id, connected) => {
        if (id.mac == this.data.id.mac && !connected.bluetooth) {
          wx.showModal({
            title: '设备离线',
            showCancel: false,
          });
          wx.navigateBack({
            delta: 2,
          })
        }
      }
    };
    Comm.listeners.add(this.data.listener);

    try {
      Comm.wait({
        id,
        time: 5000,
        prepare: async () => {
          await wx.showLoading({
            title: '正在连接',
            mask: true,
          });
          await Comm.connect(id);
          await Comm.sendMessage(id, JSON.stringify({type: 'get'}));
        },
        success: () => {
          wx.hideLoading();
        },
        fail: async () => {
          wx.hideLoading();
          wx.showModal({
            title: '设备离线',
            showCancel: false,
          });
          wx.navigateBack({
            delta: 1,
          });
        }
      })
    }
    catch (err) {
      throw err;
    }
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query.select('.long-button').boundingClientRect((rect) => {
      if (rect) {
        this.setData({
          dragWidth: rect.width,
        });
        this.data.buttons.brightness.left = rect.left;
      }
    }).exec();
  },

  onUnload() {
    Comm.listeners.delete(this.data.listener);
    Comm.disconnect(this.data.id);
  },
  
  dragStart(e) {
    const name = e.currentTarget.dataset.name;
    const button = this.data.buttons[name];
    button.startX = e.changedTouches[0].clientX;
    button.startValue = button.getValue.bind(this)();
  },

  dragTouch(e) {
    const name = e.currentTarget.dataset.name;
    const button = this.data.buttons[name];
    const value = Math.floor(Math.max(0, Math.min(button.startValue + (e.changedTouches[0].clientX - button.startX) / this.data.dragWidth * 100, 100)));
    button.setValue.bind(this)(value);
    
    if (value === 0 || value === 100) {
      if (!this.data.vibrateShort) {
        wx.vibrateShort({
          type: "heavy",
          success: () => this.setData({vibrateShort: true}),
        });
      }
    }
    else this.setData({vibrateShort: false});
  },

  async dragEnd(e) {
    const name = e.currentTarget.dataset.name;
    const button = this.data.buttons[name];
    if (e.changedTouches[0].clientX == button.startX) {
      const value = Math.floor((e.changedTouches[0].clientX - button.left) / this.data.dragWidth * 100);
      button.setValue.bind(this)(value);
    };
    let message = '';
    if (name == 'brightness') message = JSON.stringify({ bn: this.data.brightness});
    else if (name == 'color') message = JSON.stringify({ color: this.data.color});
    await Comm.sendMessage(this.data.id, message);
  },

  onTouchStart(e) {
    let name = e.currentTarget.dataset.name;
    let newButton = { ...(this.data.buttons[name]), isPressed: true };
    let newButtons = {...this.data.buttons};
    newButtons[name] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onTouchEnd(e) {
    let name = e.currentTarget.dataset.name;
    let newButton = { ...(this.data.buttons[name]), isPressed: false };
    let newButtons = {...this.data.buttons};
    newButtons[name] = newButton;
    this.setData({
      buttons: newButtons,
    });
  },

  onTap(e) {
    let name = e.currentTarget.dataset.name;
    wx.vibrateShort({
      type: "medium",
      success: async () => {
        if (name == 'config') {
          wx.navigateTo({
            url: `/pages/setup/setup?deviceId=${this.data.id.deviceId}&mac=${this.data.id.mac}`,
          });
        }
        else this.data.buttons[name].bindTap.bind(this)();
      },
    });
  },

  backToHome() {
    wx.navigateBack();
  },

  handleReceivedMessage(id, message) {
    if (id.mac == this.data.id.mac) {
      try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.power) {
          this.setData({
            isOpen: parsedMessage.power === 'on'
          });
        }
        if (parsedMessage.mode !== undefined) {
          this.setData({
            mode: parsedMessage.mode
          });
        }
        if (parsedMessage.bn !== undefined) {
          this.setData({
            brightness: parsedMessage.bn
          });
        }
        if (parsedMessage.color!== undefined) {
          this.setData({
            color: parsedMessage.color,
            realColor: mixColors(this.data.warmColor, this.data.coolColor, parsedMessage.color / 100),
          });
        }
        if (parsedMessage.wifi) {
          this.setData({
            isWiFiOpen: parsedMessage.wifi !== 'off',
            isWiFiConnected: parsedMessage.wifi === 'true'
          });
        }
      } catch (err) {
        console.error('解析消息失败:', err);
      }
    }
  },
});