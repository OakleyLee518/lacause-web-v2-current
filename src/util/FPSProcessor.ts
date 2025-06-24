class FPSProcessor {
  private readonly MAX_DATA_POINTS = 60 * 60
  private data: number[]

  constructor() {
    this.data = []
  }

  reset = () => {
    this.data = []
  }

  logCaptureSuccess = () => {
    const currentTime = new Date().getTime()

    if (this.data.length >= this.MAX_DATA_POINTS) {
      this.data.shift()
    }

    this.data.push(currentTime)
  }

  getFPSData = (startTime: number, endTime: number) => {
    if (endTime == undefined) {
      endTime = new Date().getTime()
    }
    if (startTime == undefined) {
      startTime = endTime - 60 * 1000
    }

    const lastMinutePoints = this.data.filter((point: number) => {
      return point > startTime && point < endTime
    })

    const captureTime = Math.round((endTime - lastMinutePoints[0]) / 1000)
    const fps = Math.round(lastMinutePoints.length / captureTime)

    return {
      fps: fps,
      totalImages: lastMinutePoints.length,
      captureTime: captureTime,
    }
  }
}

const fpsProcessorInstance = new FPSProcessor();
export default fpsProcessorInstance;
