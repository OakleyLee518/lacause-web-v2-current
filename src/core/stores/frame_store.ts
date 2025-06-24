import { MAX_FRAME_IN_BUFFER } from "@/constant"

export interface FrameData {
  frame: number[][]
  timesec: number // now in ms
}

export interface FrameStoreInterface {
  getFramesSince(startTime: number): number[][][]
  addFrame(frame: number[][], time: number): void
  addRppgPltData(data: number[]): void
  addRawRppgPltData(data: number[]): void
}

export class FrameStore implements FrameStoreInterface {
  frames: FrameData[]
  rppgPltData: number[]
  rppgPltDataBeforeDSP: number[]

  constructor() {
    this.frames = []
    this.rppgPltData = []
    this.rppgPltDataBeforeDSP = []
  }

  getFramesSince = (startTime: number) => {
    for (let i = 0; i < this.frames.length - 1; i++) {
      if (this.frames[i].timesec >= startTime) {
        return this.frames.slice(i).map(v => v.frame)
      }
    }
    return []

    // for debug, get the same number of frames every time
    // let frames:any[] = []
    // for (let i = 0; i < this.frames.length - 1; i++) {
    //   if (this.frames[i].timesec > startTime) {
    //     frames = this.frames.slice(i).map(v => v.frame)
    //     break
    //   }
    // }
    // return frames.slice(0, 100)
  } 

  addFrame = (frame: number[][], time: number) => {
    const fData: FrameData = {
      frame: frame,
      timesec: time, // now in ms
    }
    if (this.frames.length >= MAX_FRAME_IN_BUFFER) {
      this.frames.shift()
    }
    this.frames.push(fData)
  }

  addRppgPltData = (data: number[]) => {
    this.rppgPltData = data
  }
  addRawRppgPltData = (data: number[]) => {
    this.rppgPltDataBeforeDSP = data
  }
}

const frameStore = new FrameStore()
export default frameStore