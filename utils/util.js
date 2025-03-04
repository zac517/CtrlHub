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

/**将16进制转化为ArrayBuffer*/
function string2buffer(str){
  return new Uint8Array(str.match(/[\da-f]{2}/gi).map(function (h) {
    return parseInt(h, 16)
  })).buffer
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
      return ab2hex(randomValues);
  } catch (error) {
      return null;
  }
}

module.exports = {
  generateRandomValues,
  ab2hex,
  string2buffer,
}
