## 蓝牙相关函数封装理念
### 1.检测蓝牙适配器是否开启

由于小程序上的核心功能都依赖蓝牙，因此，我们希望看到的是蓝牙以及蓝牙适配器能在小程序运行的整个过程中保持开启。虽然我们有相关的函数可以检测蓝牙适配器的开启状态，但我认为并不需要按照某个频率不断的检测其状态。只需要在需要调用相关函数前进行检测，并在蓝牙适配器未开启时尝试打开即可。

### 2.搜寻附近的蓝牙外围设备

由于搜寻设备的过程十分消耗系统资源，相关函数届时只会在添加设备以及手动在主页下拉触发刷新时被调用，并在完成使用后即刻关闭。

## 样式规范
### 1.颜色
主题色和特定黑色均在app.wxss里设置