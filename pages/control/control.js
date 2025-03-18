import CommunicationManager from '../../utils/communicationManager'
import { mixColors } from '../../utils/util'

Page({
  data: {
    name: '',
    deviceId: '',

    isOpen: false,

    brightness: 0,

    color: 0,
    coolColor: '#ffffff',
    warmColor: '#ffddbb',
    realColor: '#ffffff',

    mode: 0,
    modeLabel: ['均衡', '夜间', '专注', '自动'],

    isWiFiOpen: false,
    isWiFiConnected: false,

    buttons: {
      power : {
        isPressed: false,
        bindTap(that) {
          const newIsOpen =! that.data.isOpen;
          that.setData({
            isOpen: newIsOpen,
          });
          return JSON.stringify({ power: newIsOpen? 'on' : 'off' });
        },
      },

      brightness : {
        startX: 0,
        startValue: 0,
        left: 0,
        getValue: (that) => that.data.brightness,
        setValue: (that, brightness) => {
          that.setData({
            brightness,
          })
        },
      },

      color : {
        startX: 0,
        startValue: 0,
        left: 0,
        getValue: (that) => that.data.color,
        setValue: (that, color) => {
          that.setData({
            color,
            realColor: mixColors(that.data.warmColor, that.data.coolColor, color / 100),
          })
        },
      },

      mode : {
        isPressed: false,
        bindTap(that) {
          let newMode = that.data.mode;
          if (newMode === 3) {
            newMode = 0;
          } else {
            newMode++;
          }
          that.setData({
            mode: newMode,
          });
          return JSON.stringify({ mode: newMode });
        },
      },

      wifi : {
        isPressed: false,
        bindTap(that) {
          const newIsWiFiOpen = !that.data.isWiFiOpen;
          that.setData({
            isWiFiOpen: newIsWiFiOpen,
          });
          return JSON.stringify({ wifi: newIsWiFiOpen? 'on' : 'off' });
        },
      },

      config : {
        isPressed: false,
      },
    },
    
    dragWidth: 0,

    vibrateShort: false,

    task: null,
  },

  async onLoad(options) {
    this.setData({
      name: options.name,
      deviceId: options.deviceId,
    });
    let deviceId = this.data.deviceId;

    this.data.task = {
      callbacks: {
        onStateChange: state => {
          if (!(state.bluetooth.available || state.mqtt)) {
            wx.showModal({
              title: 'WiFi 和蓝牙均不可用',
              showCancel: false,
              success: (res) => {
                wx.navigateBack({
                  delta: 2,
                })
              }
            });
          }
        },
        onMessageReceived: (deviceId, message) => {
          this.handleReceivedMessage(deviceId, message);
        },
      },
      setup: async () => {
        await CommunicationManager.connect(deviceId);
        await CommunicationManager.sendMessage(this.data.deviceId, JSON.stringify({type: 'get'}));
      },
      recover: async () => {
        await CommunicationManager.connect(deviceId);
        await CommunicationManager.sendMessage(this.data.deviceId, JSON.stringify({type: 'get'}));
      },
      end: () => CommunicationManager.disconnect(deviceId),
    }

    CommunicationManager.begin(this.data.task);
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
    CommunicationManager.finish(this.data.task);
  },
  
  dragStart(e) {
    const name = e.currentTarget.dataset.name;
    const button = this.data.buttons[name];
    button.startX = e.changedTouches[0].clientX;
    button.startValue = button.getValue(this);
  },

  dragTouch(e) {
    const name = e.currentTarget.dataset.name;
    const button = this.data.buttons[name];
    const value = Math.floor(Math.max(0, Math.min(button.startValue + (e.changedTouches[0].clientX - button.startX) / this.data.dragWidth * 100, 100)));
    button.setValue(this, value);
    if (value === 0 || value === 100) {
      if (!this.data.vibrateShort) {
        wx.vibrateShort({
          type: "heavy",
          success: () => this.setData({vibrateShort: true}),
        });
      } 
    }
    else {
      this.setData({vibrateShort: false});
    }
  },

  async dragEnd(e) {
    const name = e.currentTarget.dataset.name;
    const button = this.data.buttons[name];
    if (e.changedTouches[0].clientX == button.startX) {
      const value = Math.floor((e.changedTouches[0].clientX - button.left) / this.data.dragWidth * 100);
      button.setValue(this, value);
    };
    let message = '';
    if (name == 'brightness') message = JSON.stringify({ bn: this.data.brightness});
    else if (name == 'color') message = JSON.stringify({ color: this.data.color});
    try {
      await CommunicationManager.sendMessage(this.data.deviceId, message);
    } catch (err) {
      console.error(`消息发送失败，内容: ${message}`, err);
    }
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
            url: `/pages/setup/setup?deviceId=${this.data.deviceId}`,
          });
        }
        else {
          const deviceId = this.data.deviceId;
          const message = this.data.buttons[name].bindTap(this);
          try {
            await CommunicationManager.sendMessage(deviceId, message);
            
          } catch (err) {
            console.error(`消息发送失败，内容: ${message}`, err);
          }
        }
      },
    });
  },

  backToHome() {
    wx.navigateBack();
  },

  handleReceivedMessage(deviceId, message) {
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
});