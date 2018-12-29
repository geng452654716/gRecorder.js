import Encoder from "./encoder";

let initRecorder;
class RecorderTool {
  constructor() {
    this.bufferSize = 4096;
    this.isPause = false;
    this.isRecording = false;
    this.duration = 0;
    this.volume = 0;
    this._duration = 0;
    this._isInit = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      const constraints = {
        video: false,
        audio: {
          channelCount: 1,
          echoCancellation: false
        }
      };
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          this._micCaptured(stream)
          this.isPause = false;
          this.isRecording = true;
          this.lameEncoder = new Encoder({});
          resolve(this);
        })
        .catch(error => {
          reject("No live audio input: " + error);
        });
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      this.stream.getTracks().forEach(track => track.stop());
      this.input.disconnect();
      this.processor.disconnect();
      this.context.close();

      const record = this.lameEncoder.finish();
      record.duration = this.duration;

      this._duration = 0;
      this.duration = 0;

      this.isPause = false;
      this.isRecording = false;

      resolve(record);
    });
  }

  pause() {
    this.stream.getTracks().forEach(track => track.stop());
    this.input.disconnect();
    this.processor.disconnect();
    this.context.close();

    this._duration = this.duration;
    this.isPause = true;
  }

  _micCaptured(stream) {
    this.context = new(window.AudioContext || window.webkitAudioContext)();
    this.duration = this._duration;
    this.input = this.context.createMediaStreamSource(stream);
    this.processor = this.context.createScriptProcessor(this.bufferSize, 1, 1);
    this.stream = stream;

    this.processor.onaudioprocess = ev => {
      const sample = ev.inputBuffer.getChannelData(0);
      let sum = 0.0;
      this.lameEncoder.encode(sample);

      for (let i = 0; i < sample.length; ++i) {
        sum += sample[i] * sample[i];
      }

      this.duration =
        parseFloat(this._duration) +
        parseFloat(this.context.currentTime.toFixed(2));
      this.volume = Math.sqrt(sum / sample.length).toFixed(2);
    };

    this.input.connect(this.processor);
    this.processor.connect(this.context.destination);
  }
}

let _initRecorder = () => {
  if (!initRecorder) {
    initRecorder = new RecorderTool();
  }
  return initRecorder;
};
export default _initRecorder;