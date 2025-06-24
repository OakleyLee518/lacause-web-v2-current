import { cropImageData } from "@/util/util";
import "@mediapipe/tasks-vision"
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from "@mediapipe/tasks-vision";
import attentionStore, { AttentionData } from "@/core/stores/attention_store";

class PosePredictorProcessor {
  faceLandmarker: FaceLandmarker | null

  constructor() {
    this.faceLandmarker = null
  }

  public async loadModel() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    this.faceLandmarker = await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath: "/models/face_landmark/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "IMAGE",
        outputFaceBlendshapes: true,
        numFaces: 1
      });
      console.log(`faceLandmarker loaded succesfully`);
  }

  public estimatePoseFromLandmarks(landmark: NormalizedLandmark[]) {
    // Extracting main landmarks
    const rightEyeOuter = [landmark[33].x, landmark[33].y]
    const leftEyeOuter = [landmark[263].x, landmark[263].y]
    const noseTip = [landmark[1].x, landmark[1].y]
    const eyeCenter = [(rightEyeOuter[0] + leftEyeOuter[0]) / 2, (rightEyeOuter[1] + leftEyeOuter[1]) / 2]

    // Calculations
    // const dx = rightEyeOuter[0] - leftEyeOuter[0]
    // const dy = rightEyeOuter[1] - leftEyeOuter[1]
    // const roll = Math.atan2(dy, dx) * (180 / Math.PI)

    const eyeToNose = [noseTip[0] - eyeCenter[0], noseTip[1] - eyeCenter[1]]
    const yaw = Math.atan2(eyeToNose[1], eyeToNose[0]) * (180 / Math.PI)

    // const eyeToNoseLength = Math.sqrt(eyeToNose.reduce((sum, val) => sum + val ** 2, 0))
    // const eyeDistance = Math.sqrt([rightEyeOuter[0] - leftEyeOuter[0], rightEyeOuter[1] - leftEyeOuter[1]].reduce((sum, val) => sum + val ** 2, 0))
    // const pitch = Math.atan2(eyeToNoseLength, eyeDistance) * (180 / Math.PI)

    return yaw
  }

  public async estimate(frame: ImageData, faceBox: number[]) {
    // currently no idea to trans greyscale image in ImageData
    const frameCropped = cropImageData(frame, faceBox[0], faceBox[1], faceBox[2], faceBox[3])
    const result = this.faceLandmarker!.detect(frameCropped);
    const data: AttentionData = {
      time: new Date().getTime(),
      yaw: attentionStore.getNewestYaw(),
      face: 0
    }
    if (result.faceLandmarks.length > 0) {
      const yaw = this.estimatePoseFromLandmarks(result.faceLandmarks[0])
      data.yaw = yaw
      data.face = 1
    }
    attentionStore.add(data)
    return result
  }
}

const posePredictorProcessor = new PosePredictorProcessor()
export default posePredictorProcessor