// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { nickName, avatarUrl } = event;
  const userCollection = db.collection('users');
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  console.log(wxContext);

  try {
    // 检查用户是否已经注册
    const user = await userCollection.where({ openid }).get();

    if (user.data.length === 0) {
      // 新用户，创建用户记录
      await userCollection.add({
        data: {
          openid,
          nickName,
          avatarUrl,
          createdAt: db.serverDate(),
          lastLogin: db.serverDate()
        }
      });
    } else {
      // 已有用户，更新登录时间等信息
      await userCollection.where({ openid }).update({
        data: {
          nickName,
          avatarUrl,
          lastLogin: db.serverDate()
        }
      });
    }

    return {
      success: true,
      openid: openid
    };
  } catch (error) {
    console.error('操作失败', error);
    return {
      success: false,
      error: error.message
    };
  }
};
