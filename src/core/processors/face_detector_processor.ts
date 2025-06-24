import { FACE_CONFIDENCE, FACE_DETECTION_DIM, FACE_DETECTOR_MODEL_URI } from "@/constant";
import { InferenceSession, Tensor } from "onnxruntime-web";
import cv from "opencv-ts"

export interface FaceDetectorProcessorInterface {
  loadModel(): Promise<boolean>
}

class FaceDetectorProcessor implements FaceDetectorProcessorInterface {
  model: InferenceSession | null;
  inputName: string;
  outputName0: string;
  outputName1: string;

  constructor() {
    this.model = null;
    this.inputName = '';
    this.outputName0 = '';
    this.outputName1 = '';
  }

  public async loadModel() {
    if (this.model === null) {
      this.model = await InferenceSession.create(FACE_DETECTOR_MODEL_URI);
      this.inputName = this.model.inputNames[0];
      this.outputName0 = this.model.outputNames[0];
      this.outputName1 = this.model.outputNames[1];
      console.log(`faceDetectorModel loaded succesfully, i:${this.model.inputNames}, o:${this.model.outputNames}`);
    }
    return true;
  }
  
  public async detectBestFaceBox(frame: ImageData) {
    if (this.model === null) {
      throw new Error('faceDetectModel not loaded')
    }
    const frameRGB = new cv.Mat()
    const frameResized = new cv.Mat()
    const matFrame = cv.matFromImageData(frame)

    cv.resize(matFrame, frameResized, new cv.Size(FACE_DETECTION_DIM, FACE_DETECTION_DIM))
    cv.cvtColor(frameResized, frameRGB, cv.COLOR_BGR2RGB)
    const inputTensor = new Tensor('float32', new Float32Array(frameRGB.data), [1, FACE_DETECTION_DIM, FACE_DETECTION_DIM, 3]);
    
    // must delete, important!
    frameRGB.delete()
    frameResized.delete()
    matFrame.delete()
    
    const inputs = { [this.inputName]: inputTensor };
    const result = await this.model.run(inputs);
    const boxes = Array.from(result[this.outputName0].data, Number)
    const conf = Array.from(result[this.outputName1].data, Number)

    const detectedBoxes = boxes.flatMap((v, i, array) => {
      if (conf[Math.floor(i/4)] >= FACE_CONFIDENCE && i % 4 === 0) {
        return [array.slice(i, i+4)]
      }
      return []
    })
    const detectedConfs = conf.filter(v => v >= FACE_CONFIDENCE)
    const numFaces = detectedBoxes.length

    if (numFaces > 0) {
      // Find the largest box
      const areas = detectedBoxes.map(box => box[2] * box[3])
      const maxAreaIdx = areas.indexOf(Math.max(...areas))
      const detectedBox = detectedBoxes[maxAreaIdx]
      const detectedConf = detectedConfs[maxAreaIdx]

      let left = 0, top = 0, right = 0, bottom = 0
      // Check if the box is valid
      if (detectedBox[0] !== -1 && detectedBox[1] !== -1 && detectedConf >= FACE_CONFIDENCE) {
        let centerX = detectedBox[0], centerY = detectedBox[1], width = detectedBox[2], height = detectedBox[3]
        // Rescale the coordinates back to original frame size for plotting. So the prediction was done on (DIM,DIM), but the webcam frame is (frame_height, frame_width)
        // So, we need to rescale them to plot on the webcam image itself. It is litterally just a scaling operation
        centerX = Math.floor(centerX * frame.width / FACE_DETECTION_DIM)
        centerY = Math.floor(centerY * frame.height / FACE_DETECTION_DIM)
        width = Math.floor(width * frame.width / FACE_DETECTION_DIM)
        height = Math.floor(height * frame.height / FACE_DETECTION_DIM)

        // Calculate the top-left and bottom-right corners of the bounding box
        // There weird coordinates are a bug/remnant of keras_cv bounding box utilities I think
        left = centerX - width; top = centerY - height; right = centerX; bottom = centerY;
      }
      return [detectedConf, left, top, right, bottom]

    } else {
      return []
    }
  }
}

const faceDetectorProcessor = new FaceDetectorProcessor()
export default faceDetectorProcessor
