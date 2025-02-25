// 检查蓝牙适配器是否开启函数
function isBluetoothAdapterOpened () {
  wx.getBluetoothAdapterState({
    success (res) {
      if (res.available) {
        return true;
      }
      else {
        wx.openBluetoothAdapter({
          success (res) {
            return true;
          },
          fail (err) {
            return false;
          }
        })
      }
    },
    fail (err) {
      console.log("获取本机蓝牙适配器状态失败");
      console.log(err);
      return false;
    }
  })
}

// 已添加的设备列表
let devices = [
  {
    deviceId: "testDeviceId",
    UUID: "testUUID",
    isOnline: false,
  },
]

// 更新设备列表在线状态
function updateDeviceState () {
  // 检查是否已开启蓝牙
  if (isBluetoothAdapterOpened()) {
    // 根据已添加的设备列表生成UUID查找列表
    let uuidList = devices.map(device => device.UUID);
    // 调用API
    wx.startBluetoothDevicesDiscovery({
      services: uuidList,
      success (res) {
        // 监听
      },
      fail (err) {
        console.log("开始搜寻附近的蓝牙外围设备失败");
        console.log(err);
        wx.showToast({
          title: '请开启手机蓝牙',
          icon: 'none'
        });
      }
    })
  }
  // 如果蓝牙没有开启
  else {
    wx.showToast({
      title: '请开启手机蓝牙',
      icon: 'none'
    });
  }
}

module.exports = {
  isBluetoothAdapterOpened,
}