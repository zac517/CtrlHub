import Comm from '../../utils/comm.js';
import {
  mixColors
} from '../../utils/util'

Page({
  data: {
    name: '',
    mac: '',

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
      power: {
        isPressed: false,
        bindTap() {
          const newIsOpen = !this.data.isOpen;
          this.setData({
            isOpen: newIsOpen
          });
          const message = JSON.stringify({
            power: newIsOpen ? 'on' : 'off'
          });
          Comm.sendMessage(this.data.mac, message);
        },
      },

      brightness: {
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

      color: {
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

      mode: {
        isPressed: false,
        bindTap() {
          let newMode = this.data.mode;
          if (newMode === 3) newMode = 0;
          else newMode++;
          this.setData({
            mode: newMode
          });
          const message = JSON.stringify({
            mode: newMode
          });
          Comm.sendMessage(this.data.mac, message);
        },
      },

      wifi: {
        isPressed: false,
        bindTap() {
          const newIsWiFiOpen = !this.data.isWiFiOpen;
          this.setData({
            isWiFiOpen: newIsWiFiOpen
          });
          const message = JSON.stringify({
            wifi: newIsWiFiOpen ? 'on' : 'off'
          });
          Comm.sendMessage(this.data.mac, message);
        },
      },

      config: {
        isPressed: false,
      },
    },

    connected: false,
    listener: null,
  },

  async onLoad(options) {
    Comm.bind(options.mac, options.deviceId);

    this.setData({
      name: options.name,
      mac: options.mac,
    });

    this.data.listener = {
      onMessageReceived: (mac, message) => this.handleReceivedMessage(mac, message),
      onConnectionChange: (mac, connected) => {
        if (mac == this.data.mac) {
          if (connected) this.data.connected = true;
          else {
            wx.showModal({
              title: '设备离线',
              showCancel: false,
            });
            wx.navigateBack({
              delta: 2
            })
          }
        }
      }
    };
    Comm.listeners.add(this.data.listener);

    const mac = this.data.mac;
    await wx.showLoading({
      title: '正在连接',
      mask: true,
    });
    try {
      await Comm.connect(mac);
      wx.hideLoading();
      await Comm.sendMessage(mac, JSON.stringify({
        type: 'get'
      }));
    } catch (err) {
      wx.hideLoading();
      wx.showModal({
        title: '设备离线',
        showCancel: false,
      });
      wx.navigateBack({
        delta: 1,
      });
    }
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query.select('.long-button').boundingClientRect((rect) => {
      if (rect) {
        this.setData({
          dragWidth: rect.width
        });
        this.data.buttons.brightness.left = rect.left;
      }
    }).exec();
  },

  onUnload() {
    Comm.listeners.delete(this.data.listener);
    if (this.data.connected) Comm.disconnect(this.data.mac);
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
          success: () => this.setData({
            vibrateShort: true
          }),
        });
      }
    } else this.setData({
      vibrateShort: false
    });
  },

  async dragEnd(e) {
    const name = e.currentTarget.dataset.name;
    const button = this.data.buttons[name];
    if (e.changedTouches[0].clientX == button.startX) {
      const value = Math.floor((e.changedTouches[0].clientX - button.left) / this.data.dragWidth * 100);
      button.setValue.bind(this)(value);
    };
    let message = '';
    if (name == 'brightness') message = JSON.stringify({
      bn: this.data.brightness
    });
    else if (name == 'color') message = JSON.stringify({
      color: this.data.color
    });
    await Comm.sendMessage(this.data.mac, message);
  },

  onTouchStart(e) {
    let name = e.currentTarget.dataset.name;
    let newButton = {
      ...(this.data.buttons[name]),
      isPressed: true
    };
    let newButtons = {
      ...this.data.buttons
    };
    newButtons[name] = newButton;
    this.setData({
      buttons: newButtons
    });
  },

  onTouchEnd(e) {
    let name = e.currentTarget.dataset.name;
    let newButton = {
      ...(this.data.buttons[name]),
      isPressed: false
    };
    let newButtons = {
      ...this.data.buttons
    };
    newButtons[name] = newButton;
    this.setData({
      buttons: newButtons
    });
  },

  onTap(e) {
    let name = e.currentTarget.dataset.name;
    wx.vibrateShort({
      type: "medium",
      success: async () => {
        if (name == 'config') {
          wx.navigateTo({
            url: `/pages/setup/setup?mac=${this.data.mac}`,
          });
        } else this.data.buttons[name].bindTap.bind(this)();
      },
    });
  },

  backToHome() {
    wx.navigateBack();
  },

  handleReceivedMessage(mac, message) {
    if (mac == this.data.mac) {
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
        if (parsedMessage.color !== undefined) {
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