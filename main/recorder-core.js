import { Mp3Encoder } from "lamejs";
export default (function(window) {
  //兼容环境
  window.RecorderLM = "2018-12-09 19:16";
  var NOOP = function() {};
  var $ = {
    extend: function(a, b) {
      a || (a = {});
      b || (b = {});
      for (var k in b) {
        a[k] = b[k];
      }
      return a;
    }
  };
  function Recorder(set) {
    return new initFn(set);
  }

  function initFn(set) {
    this.set = $.extend(
      {
        type: "mp3",
        bitRate: 16,

        sampleRate: 16000,

        bufferSize: 8192,
        onProcess: NOOP
      },
      set
    );
  }
  Recorder.prototype = initFn.prototype = {
    IsOpen: function() {
      var stream = Recorder.Stream;
      if (stream) {
        var tracks = stream.getTracks();
        if (tracks.length > 0) {
          return tracks[0].readyState == "live";
        }
      }
      return false;
    },
    open: function(True, False) {
      True = True || NOOP;
      False = False || NOOP;

      if (this.IsOpen()) {
        True();
        return;
      }
      var notSupport = "此浏览器不支持录音";
      var AC = window.AudioContext;
      if (!AC) {
        AC = window.webkitAudioContext;
      }
      if (!AC) {
        False(notSupport);
        return;
      }
      var scope = navigator.mediaDevices || {};
      if (!scope.getUserMedia) {
        scope = navigator;
        scope.getUserMedia ||
          (scope.getUserMedia =
            scope.webkitGetUserMedia ||
            scope.mozGetUserMedia ||
            scope.msGetUserMedia);
      }
      if (!scope.getUserMedia) {
        False(notSupport);
        return;
      }

      Recorder.Ctx = Recorder.Ctx || new AC();
      var f1 = function(stream) {
        Recorder.Stream = stream;
        True();
      };
      var f2 = function(e) {
        var code = e.name || e.message || "";
        console.error(e);
        False(
          /Permission|Allow/i.test(code)
            ? "用户拒绝了录音权限"
            : "无法录音：" + code
        );
      };
      var pro = scope.getUserMedia(
        {
          audio: true
        },
        f1,
        f2
      );
      if (pro && pro.then) {
        pro.then(f1)["catch"](f2);
      }
    },
    //关闭释放录音资源
    close: function(call) {
      call = call || NOOP;

      var This = this;
      This._stop();

      var stream = Recorder.Stream;
      if (stream) {
        var tracks = stream.getTracks();
        for (var i = 0; i < tracks.length; i++) {
          tracks[i].stop();
        }
      }

      Recorder.Stream = 0;
      call();
    },

    start: function() {
      console.log("[" + Date.now() + "]Start");
      var This = this,
        set = This.set;
      var buffer = (This.buffer = []); //数据缓冲
      This.recSize = 0; //数据大小
      This._stop();

      This.state = 0;
      if (!this.IsOpen()) {
        return;
      }

      var ctx = Recorder.Ctx;
      var media = (This.media = ctx.createMediaStreamSource(Recorder.Stream));
      var process = (This.process = (
        ctx.createScriptProcessor || ctx.createJavaScriptNode
      ).call(ctx, set.bufferSize, 1, 1)); //单声道，省的数据处理复杂

      var onInt;
      process.onaudioprocess = function(e) {
        if (This.state != 1) {
          return;
        }
        var o = e.inputBuffer.getChannelData(0); //块是共享的，必须复制出来
        var size = o.length;
        This.recSize += size;

        var res = new Int16Array(size);
        var power = 0;
        for (var j = 0; j < size; j++) {
          //floatTo16BitPCM
          //var s=Math.max(-1,Math.min(1,o[j]*8));//PCM 音量直接放大8倍，失真还能接受
          var s = Math.max(-1, Math.min(1, o[j]));
          s = s < 0 ? s * 0x8000 : s * 0x7fff;
          res[j] = s;
          power += Math.abs(s);
        }
        buffer.push(res);

        power /= size;
        var powerLevel = 0;
        if (power > 0) {
          //https://blog.csdn.net/jody1989/article/details/73480259
          powerLevel = Math.round(
            Math.max(0, ((20 * Math.log10(power / 0x7fff) + 34) * 100) / 34)
          );
        }
        var duration = Math.round(
          (This.recSize / Recorder.Ctx.sampleRate) * 1000
        );

        clearTimeout(onInt);
        onInt = setTimeout(function() {
          set.onProcess(buffer, powerLevel, duration);
        });
      };

      media.connect(process);
      process.connect(ctx.destination);
      This.state = 1;
    },
    _stop: function() {
      var This = this;
      if (This.state) {
        This.state = 0;
        This.media.disconnect();
        This.process.disconnect();
      }
    },
    /*暂停录音*/
    pause: function(_resume) {
      var This = this;
      if (This.state) {
        This.state = _resume || 2;
      }
    },
    /*恢复录音*/
    resume: function() {
      this.pause(1);
    },
    /*
      结束录音并返回录音数据blob对象
      	True(blob,duration) blob：录音数据audio/mp3|wav格式
      						duration：录音时长，单位毫秒
      	False(msg)
      */
    stop: function(True, False) {
      console.log("[" + Date.now() + "]Stop");
      True = True || NOOP;
      False = False || NOOP;
      var This = this,
        set = This.set;

      if (!This.state) {
        False("未开始录音");
        return;
      }
      This._stop();
      var size = This.recSize;
      if (!size) {
        False("未采集到录音");
        return;
      }

      var sampleRate = set.sampleRate,
        ctxSampleRate = Recorder.Ctx.sampleRate;
      //采样 https://www.cnblogs.com/blqw/p/3782420.html
      var step = ctxSampleRate / sampleRate;
      if (step > 1) {
        //新采样高于录音采样不处理，省去了插值处理，直接抽样
        size = Math.floor(size / step);
      } else {
        step = 1;
        sampleRate = ctxSampleRate;
        set.sampleRate = sampleRate;
      }
      //准备数据
      var res = new Int16Array(size);
      var last = 0,
        idx = 0;
      for (var n = 0, nl = This.buffer.length; n < nl; n++) {
        var o = This.buffer[n];
        var i = last,
          il = o.length;
        while (i < il) {
          res[idx] = o[Math.round(i)];
          idx++;
          i += step; //抽样
        }
        last = i - il;
      }
      var duration = Math.round((size / sampleRate) * 1000);

      setTimeout(function() {
        var t1 = Date.now();
        This[set.type](
          res,
          function(blob) {
            console.log(
              "[" + Date.now() + "]End",
              blob,
              duration,
              "编码耗时:" + (Date.now() - t1)
            );
            True(blob, duration);
          },
          function(msg) {
            False(msg);
          }
        );
      });
    }
    //end ****copy源码结束，到wav、mp3前面为止*****
  };
  Recorder.prototype.enc_mp3 = {
    stable: true,
    testmsg:
      "采样率范围48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000"
  };

  Recorder.prototype.mp3 = function(res, True) {
    var This = this,
      set = This.set,
      size = res.length;
    //https://github.com/wangpengfei15975/recorder.js
    //https://github.com/zhuker/lamejs bug:采样率必须和源一致，不然8k时没有声音，有问题fix：https://github.com/zhuker/lamejs/pull/11
    var mp3 = new Mp3Encoder(1, set.sampleRate, set.bitRate);

    var blockSize = 5760;
    var data = [];

    var idx = 0;
    var run = function() {
      if (idx < size) {
        let buf = mp3.encodeBuffer(res.subarray(idx, idx + blockSize));
        if (buf.length > 0) {
          data.push(buf);
        }
        idx += blockSize;
        setTimeout(run); //Worker? 复杂了
      } else {
        let buf = mp3.flush();
        if (buf.length > 0) {
          data.push(buf);
        }

        True(
          new Blob(data, {
            type: "audio/mp3"
          })
        );
      }
    };
    run();
  };

  window.Recorder = Recorder;
  return Recorder;
})(window);
