import Recorder from "./recorder-core";

const recorder = Recorder();
export default {
  open() {
    return new Promise((resolve, reject) => {
      recorder.open(
        () => {
          resolve(this);
        },
        er => {
          reject(er);
        }
      );
    });
  },
  close() {
    return new Promise(resolve => {
      recorder.close(() => {
        resolve(this);
      });
    });
  },
  start() {
    return recorder.start();
  },
  stop() {
    return new Promise((resolve, reject) => {
      recorder.stop(
        (blob, duration) => {
          let url = URL.createObjectURL(blob);
          resolve({
            blob,
            duration,
            url
          });
        },
        errMsg => {
          reject(errMsg);
        }
      );
    });
  },
  pause() {
    return recorder.pause();
  },
  resume() {
    return recorder.resume();
  },
  isOpen() {
    return recorder.IsOpen();
  },
  isPause() {
    return recorder.state === 2;
  }
};