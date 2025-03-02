import { encode } from "base64-arraybuffer";

const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

async function generateRandomValues(length = 6) {
  try {
      const randomValues = await new Promise((resolve, reject) => {
          wx.getRandomValues({
              length,
              success: res => {
                  resolve(res.randomValues);
              },
              fail: err => {
                  reject(err);
              }
          });
      });
      // 将 ArrayBuffer 转换为 Base64 字符串
      const base64String = encode(randomValues);
      return base64String;
  } catch (error) {
      return null;
  }
}

module.exports = {
  formatTime,
  generateRandomValues,
}
