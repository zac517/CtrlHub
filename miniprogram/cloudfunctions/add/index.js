// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { deviceId, openid, name, space } = event;
  const deviceCollection = db.collection('devices');

  // 检查设备是否已经存在
  const device = await deviceCollection.where({ deviceId }).get();

  if (device.data.length === 0) {
    // 新设备，创建设备记录
    await deviceCollection.add({
      data: {
        deviceId,
        openid,
        name,
        space,
        createdAt: db.serverDate(),
        lastUpdated: db.serverDate()
      }
    });
  } else {
    // 已有设备，更新绑定信息
    await deviceCollection.where({ deviceId }).update({
      data: {
        openid,
        name,
        space,
        lastUpdated: db.serverDate()
      }
    });
  }

  return {
    success: true,
    deviceId: deviceId,
    openid: openid
  };
};
