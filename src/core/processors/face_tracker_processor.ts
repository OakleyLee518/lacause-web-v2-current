import { FaceDetectorProcessorInterface } from "@/core/processors/face_detector_processor"
import faceDetector from "@/core/processors/face_detector_processor"
import { stabilizeFaceBoxV2, validateFaceBox } from "@/util/util"
// @ts-expect-error mosse has no types, using as any for filter import
import mosse from "mosse"
import { MAX_TRACKING_FRAME, WEBCAM_HEIGHT, WEBCAM_WIDTH } from "@/constant"

// export interface FaceTrackerProcessorInterface { }
type FaceTrackerProcessorInterface = object

class FaceTrackerProcessor implements FaceTrackerProcessorInterface {
  frameCount = 0
  static bestFaceConfidence = 0.0
  static bestFaceFrame: ImageData
  faceBox: number[] = [0, 0, 0, 0, 0]
  faceDetector: FaceDetectorProcessorInterface
  mossef_face = new mosse.mosseFilter({psrThreshold : 5});
  facePosition = [0, 0] // only use for mosse tracker
  stabelFaceBox: number[] = [0, 0, 0, 0, 0]
  isValid = true

  constructor(faceDetector: FaceDetectorProcessorInterface) {
    this.faceDetector = faceDetector
    this.mossef_face.load(mosse.filters.face_filter);
  }

  public async trackOneFrame(frame: ImageData, webcamCanvas: unknown) {
    let isValid: boolean
    let validBestFaceBox: number[]
    // 1 from detector and 9 from tracker
    if (this.frameCount % MAX_TRACKING_FRAME === 0) {
      // console.log("Detect face again")
      const bestFaceBox = await faceDetector.detectBestFaceBox(frame)
      const [isValidTmp, validBestFaceBoxTmp] = validateFaceBox(bestFaceBox, [frame.width, frame.height], 0.2)
      isValid = isValidTmp as boolean
      validBestFaceBox = validBestFaceBoxTmp as number[]
      this.facePosition = [(validBestFaceBox[1] + validBestFaceBox[3])/2, (validBestFaceBox[2] + validBestFaceBox[4])/2]

      if (isValid) {
        const currentConfidence = bestFaceBox[0]
        const previousConfidence = FaceTrackerProcessor.bestFaceConfidence

        if (currentConfidence > previousConfidence) {
          FaceTrackerProcessor.bestFaceConfidence = currentConfidence
          FaceTrackerProcessor.bestFaceFrame = frame
        }
      }
    } else {
      // console.log("tracker")
      isValid = false
      const [left, top, right, bottom] = this.faceBox.slice(1)
      const width = right - left
      const height = bottom - top
      // tracker needs a smaller face size
      const widthForTracker = width / 5
      const centerX = (left + right) / 2
      const centerY = (top + bottom) / 2
      let faceResult
      if (this.frameCount === 1) {        
        faceResult = this.mossef_face.track(webcamCanvas, centerX-widthForTracker, centerY-widthForTracker, widthForTracker, widthForTracker, false)
        this.facePosition[0] = centerX-widthForTracker + faceResult[0];
        this.facePosition[1] = centerY-widthForTracker + faceResult[1];
      } else {
        // refer exsample from: https://github.com/auduno/mosse/blob/master/examples/filtertest_gum_face.html
        if (this.frameCount < 200) {
          faceResult = this.mossef_face.track(webcamCanvas, Math.round(this.facePosition[0]-(widthForTracker/2)), Math.round(this.facePosition[1]-(widthForTracker/2)), widthForTracker, widthForTracker, true, true)
        } else {
          faceResult = this.mossef_face.track(webcamCanvas, Math.round(this.facePosition[0]-(widthForTracker/2)), Math.round(this.facePosition[1]-(widthForTracker/2)), widthForTracker, widthForTracker, false, true)
        }
        this.facePosition[0] += (faceResult[0]-(widthForTracker/2));
        this.facePosition[1] += (faceResult[1]-(widthForTracker/2));
      }

      const trackerBox = [this.faceBox[0], this.facePosition[0]-width/2, this.facePosition[1]-height/2, this.facePosition[0]+width/2, this.facePosition[1]+height/2]

      const [isValidTmp, validBestFaceBoxTmp] = validateFaceBox(trackerBox, [frame.width, frame.height])
      isValid = isValidTmp as boolean
      validBestFaceBox = validBestFaceBoxTmp as number[]
    }

    if (isValid) {
      this.frameCount = this.frameCount + 1
      // const stabilizedFaceBox = stabilizeFaceBox(this.faceBox, validBestFaceBox)
      // this.faceBox = stabilizedFaceBox
      const stabilizedFaceBox = stabilizeFaceBoxV2(this.stabelFaceBox, validBestFaceBox, WEBCAM_WIDTH, WEBCAM_HEIGHT)
      this.stabelFaceBox = stabilizedFaceBox
      this.faceBox = validBestFaceBox
    } else {
      console.log("not valid")
      this.faceBox = []
      this.frameCount = 0
    }
    this.isValid = isValid
  }

}

const faceTrackerProcessor = new FaceTrackerProcessor(faceDetector)
export default faceTrackerProcessor