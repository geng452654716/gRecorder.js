## 录音组件，支持Mp3格式
组件为单例模式，对外暴露了一些方法，以供使用

**录音必须在 https 或 localhost 环境下使用**
#### 方法：
```javascript
  open(): Promise  // 打开录音，返回值 Prmose，其他功能必须在打开录音后才可以使用
  close()          // 关闭录音
  start()          // 开始录音
  stop()：Promise  
  /* 
    停止录音，返回值 Promise
    resolve后返回 {
      blob: blob格式数据
      url: 可直接在 audio 中播放的 url 地址
      duration： 录音时长
    }
  */
  pause()            // 暂停录音
  resume()           // 继续录音
  isOpen():Boolean   // 判断录音功能是否打开
  isPause(): Boolean // 判断录音是否暂停
```