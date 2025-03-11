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

1.暂未兼容 iPhone 设备。

### 项目特色

1.蓝牙恢复时**自动执行**指定回调函数，无需额外的错误处理。

应用场景：某个页面需要开启蓝牙持续扫描时，可以在蓝牙重连时自动恢复扫描状态。

2.蓝牙模块初始化时**持续尝试开启**蓝牙适配器，保证第一次能成功开启；尝试时间间隔**逐次倍增**，兼顾性能。

3.考虑到性能问题，将扫描封装为**快速扫描**周围设备一段时间和以一定频率**持续扫描**两种模式，分别应用于**一次或多次**需要**尽可能快地**发现周围所有的蓝牙设备和需要持续发现设备且**设备离线**时能**实时更新列表**的两种主要场景。

4.微信蓝牙模块在开始和关闭搜索后，若**不允许上报重复设备**，则**再次搜索**时之前已发现的设备无法被搜索到。本项目通过允许重复设备上报，借助 `Set` 自行维护设备列表，以支持快速搜索等功能的构建。