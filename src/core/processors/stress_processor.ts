import { ACTIVATION_MODEL_URI } from "@/constant";
import { InferenceSession, Tensor } from "onnxruntime-web";

export class StressProcessor {
  model: InferenceSession | null;
  inputName: string;
  outputName: string;

  constructor() {
    this.model = null;
    this.inputName = '';
    this.outputName = '';
  }

  loadModel = async () => {
    if (this.model === null) {
      this.model = await InferenceSession.create(ACTIVATION_MODEL_URI);
      this.inputName = this.model.inputNames[0];
      this.outputName = this.model.outputNames[0];
      console.log(`stressModel loaded succesfully, i:${this.model.inputNames}, o:${this.model.outputNames}`);
    }
    return true
  }

  predict = async (signal: number[]) => {
    // Feature extraction is not used; implement your own logic if needed
    // For now, just return a dummy value or throw if called
    throw new Error('Feature extraction and stress prediction are not implemented.');
  }
}

const stressProcessor = new StressProcessor()
export default stressProcessor 