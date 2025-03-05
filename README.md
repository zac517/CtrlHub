### home 页面 Object device 属性

|属性|类型|解释|
|-|-|-|
|id|string|设备在列表中的唯一 ID（重复添加同一设备时会重复）|
|name|string|设备名称|
|deviceId|string|设备的 deviceId，Android 设备为 Mac 地址|
|manufacturer|string|设备的制造商|
|isOnline|bool|设备在线标识|
|isSelected|bool|设备被选中标识|

### 等待修复的问题

1.下拉提前打断后进行下一次下拉出现异常

2.关闭蓝牙进入添加设备页面后开启蓝牙 设备列表无法更新 只发生在此页面第一次加载时