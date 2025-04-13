## 介绍

微信小程序通过蓝牙和 mqtt 与物联网设备进行通信，支持配网操作。

交互界面简洁，响应式布局，自适应通信，兼容 ios。

[查看硬件代码](https://github.com/zac517/CtrlNode)

### 简单使用
1. 将本项目代码克隆到本地 。
2. 微信公众平台 -> 管理 -> 开发管理 -> 开发设置 -> 服务器域名 -> socket合法域名：将 mqtt 服务器地址加入。

## 相关信息

### Object device 属性

|属性|类型|解释|
|-|-|-|
|deviceId|string|设备的 deviceId|
|mac|string|设备的 mac 地址|
|name|string|设备名称|
|manufacturer|string|制造商标识|
|isSelected|bool|设备被选中标识|

### Object listener 属性

|属性|类型|解释|
|-|-|-|
|onStateChange|function|模块状态变化回调|
|onStateRecovery|function|模块状态恢复回调|
|onConnectionChange|function|设备连接状态变化回调|
|onMessageReceived|function|收到消息回调|
|onDeviceChange|function|发现设备回调，仅适用于 BLE|

### 通信格式

#### 小程序端发送内容

|内容|解释|
|-|-|
|{"power": "on" / "off"}|点亮 / 熄灭 LED|
|{"mode": 0 / 1 / 2 / 3}|设置模式 0 / 1 / 2 / 3|
|{"bn": (0 - 100)}|设置亮度|
|{"color": (0 - 100)}|设置色温|
|{"wifi": "on" / "off"}|开启 / 关闭 WiFi|
|{"ssid": (WiFi 名称)}|发送 WiFi 名称|
|{"pw": (WiFi 密码)}|发送 WiFi 密码|
|{"type": "try"}|要求设备尝试连接 WiFi|
|{"type": "get"}|获取设备状态|

#### 小程序端接收内容

|内容|解释|
|-|-|
|{"power": "on" / "off"}|同步点亮状态|
|{"mode": 0 / 1 / 2 / 3}|同步模式|
|{"bn": (0 - 100)}|同步亮度|
|{"color": (0 - 100)}|同步色温|
|{"wifi": "true" / "false" / "off"}|同步 WiFi 状态："已连接" / "未连接" / "未开启"|

