## 介绍

微信小程序通过蓝牙和 mqtt 与物联网设备进行通信，并支持配网操作。

## 简单使用

#### 软件部分

1. 微信公众平台 -> 管理 -> 开发管理 -> 开发设置 -> 服务器域名 -> socket合法域名：将 mqtt 服务器地址加入。

#### 硬件部分
1. 库管理：搜索安装 `PubSubClient` 和 `ArduinoJson` 。
2. 开发板管理器：搜索安装 `esp32` 。
3. 选择开发板 `ESP32 Dev Module` 。
4. 工具 -> Partition Scheme：设置为 `Huge APP` 。

## 等待修复的问题


1.暂未兼容 iPhone 设备。

## 相关信息

### home 页面 Object device 属性

|属性|类型|解释|
|-|-|-|
|id|string|设备在列表中的唯一 ID（重复添加同一设备时会重复）|
|name|string|设备名称|
|deviceId|string|设备的 deviceId，Android 设备为 MAC 地址|
|manufacturer|string|设备制造商标识|
|isSelected|bool|设备被选中标识|

### 通信格式

#### 小程序发送内容

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

#### 小程序接收内容

|内容|解释|
|-|-|
|{"power": "on" / "off"}|同步点亮状态|
|{"mode": 0 / 1 / 2 / 3}|同步模式|
|{"bn": (0 - 100)}|同步亮度|
|{"color": (0 - 100)}|同步色温|
|{"wifi": "true" / "false" / "off"}|同步 WiFi 状态："已连接" / "未连接" / "未开启"|

