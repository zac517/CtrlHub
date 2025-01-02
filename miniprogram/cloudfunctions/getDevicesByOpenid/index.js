// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { openid } = event;
  
  // 检查参数是否存在
  if (!openid) {
    return {
      success: false,
      message: 'openid is required.'
    };
  }

  try {
    const devices = await db.collection('devices').where({ openid }).get();
    return {
      success: true,
      data: devices.data
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: 'Failed to get devices.',
      error: err
    };
  }
};
