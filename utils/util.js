/**将ArrayBuffer转换成字符串*/
function ab2hex(buffer){
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
      function (bit) {
        return ('00' + bit.toString(16)).slice(-2)
      }
    )
    return hexArr.join('');
}

/**获取指定长度的随机十六进制字符串*/
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
      return ab2hex(randomValues);
  } catch (error) {
      return null;
  }
}

export default {
  generateRandomValues,
}
