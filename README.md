### 介绍

### 使用
#### 硬件部分
该项目硬件部分基于 ESP32-WROOM-32 和 Arduino 平台。
1. 库管理：搜索安装 `PubSubClient` 和 `ArduinoJson` 。
2. 开发板管理器：搜索安装 `esp32` 。
3. 选择开发板 `ESP32 Dev Module` 。
3. 工具 -> Partition Scheme：设置为 `Huge APP` 。
    > 由于硬件同时使用了 WiFi 和蓝牙功能，代码编译后数据大小超出了默认分配方案的范围。 

