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
          fail (res) {
            return false;
          }
        })
      }
    },
    fail (res) {
      console.log("获取本机蓝牙适配器状态失败");
      console.log(res);
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
    // 查找已添加的设备
    let uuidList = devices.map(device => device.UUID);
    wx.startBluetoothDevicesDiscovery({
      services: uuidList,
      success (res) {
        console.log(res)
      }
    })
  }
  

}

module.exports = {
  isBluetoothAdapterOpened,
}