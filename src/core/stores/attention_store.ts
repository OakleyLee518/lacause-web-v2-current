import { MAX_FRAME_IN_BUFFER, VPPG_TIME_LEN } from "@/constant"
import { headShakingCount } from "@/util/util"

export interface AttentionData {
  time: number
  yaw: number
  face: number
}

const MAX_DATA = MAX_FRAME_IN_BUFFER // 1000

class AttentionStore {
  data: AttentionData[]

  constructor() {
    this.data = []
  }

  add(data: AttentionData) {
    if (this.data.length >= MAX_DATA) {
      this.data.shift()
    }

    this.data.push(data)
  }

  getNewestYaw() {
    if (this.data.length === 0) {
      return 0
    }
    return this.data[this.data.length - 1].yaw
  }

  query(startTime?: number, endTime?: number) {
    endTime = endTime ?? new Date().getTime()
    startTime = startTime ?? endTime - VPPG_TIME_LEN * 1000

    return this.data.filter((value) => {
      return value.time > startTime && value.time < endTime
    })
  }

  stat(startTime?: number, endTime?: number) {
    const data = this.query(startTime, endTime)
    const l = data.length

    // Debug: log the window
    const face0 = data.filter(d => d.face === 0).length;
    const face1 = data.filter(d => d.face === 1).length;
    console.log(`[DEBUG] stat window: face=0: ${face0}, face=1: ${face1}`);

    let face = 0
    const allPoses: number[] = []

    data.forEach(({ yaw, face: faceVal }) => {
      allPoses.push(yaw)
      face += faceVal
    })

    const headStability = headShakingCount(allPoses)

    return [
      Math.round((face / l) * 100) / 100,
      headStability,
    ]
  }
}

const attentionStore = new AttentionStore()
export default attentionStore