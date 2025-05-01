/**混合颜色，输入和输出为十六进制颜色格式字符串*/
export function mixColors(color1, color2, ratio) {
  // 将颜色值转换为RGB数组
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  // 计算混合后的RGB值
  const mixedR = Math.round(rgb1[0] * ratio + rgb2[0] * (1 - ratio));
  const mixedG = Math.round(rgb1[1] * ratio + rgb2[1] * (1 - ratio));
  const mixedB = Math.round(rgb1[2] * ratio + rgb2[2] * (1 - ratio));

  // 将混合后的RGB值转换为十六进制颜色值
  return rgbToHex(mixedR, mixedG, mixedB);
}

function hexToRgb(hex) {
  // 去除#号
  hex = hex.replace('#', '');

  // 如果十六进制颜色值是3位，转换为6位
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  // 转换为RGB数组
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return [r, g, b];
}

function rgbToHex(r, g, b) {
  const componentToHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}