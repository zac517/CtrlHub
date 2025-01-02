### 介绍
微信小程序通过蓝牙为物联网设备配置 WiFi 网络，设备间通过 mqtt 服务器进行通信，实现小程序对物联网设备的控制。

### 简单使用
#### 软件部分
该项目软件部分基于微信小程序，后端基于微信云开发， 所需具体内容请阅读代码。
> 
1. 云开发 -> 云函数：新建所需的云函数，上传并部署相关代码。
2. 云开发 -> 云函数：创建所需集合。
3. 在代码相关位置修改 mqtt 服务器配置。
4. 微信公众平台 -> 管理 -> 开发管理 -> 开发设置 -> 服务器域名 -> socket合法域名：将 mqtt 服务器地址加入。

#### 硬件部分
该项目硬件部分基于 ESP32-WROOM-32 和 Arduino 平台。
1. 库管理：搜索安装 `PubSubClient` 和 `ArduinoJson` 。
2. 开发板管理器：搜索安装 `esp32` 。
3. 选择开发板 `ESP32 Dev Module` 。
4. 工具 -> Partition Scheme：设置为 `Huge APP` 。