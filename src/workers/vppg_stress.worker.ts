import * as Comlink from 'comlink';
import * as ort from 'onnxruntime-web';
import { tensor } from '@tensorflow/tfjs';
// Import or copy necessary utility functions from util/array, util/DSP, etc.
// You may need to adjust import paths or inline some utilities for worker compatibility.

// --- VPPG Processor logic (simplified for worker) ---
let vppgModel: ort.InferenceSession | null = null;
let zombieModel: ort.InferenceSession | null = null;
let vppgInputNames: readonly string[] = [];
let vppgOutputName: string = '';

// --- Stress Processor logic (simplified for worker) ---
let stressModel: ort.InferenceSession | null = null;
let stressInputName: string = '';
let stressOutputName: string = '';

const VPPG_16FPS_MODEL_URI = '/models/vppg/dev_olive_vppg-16fps_v3.0.0.onnx';
const VPPG_24FPS_MODEL_URI = '/models/vppg/dev_olive_vppg-24fps_v3.0.0.onnx';
const VPPG_30FPS_MODEL_URI = '/models/vppg/dev_olive_vppg-30fps_v3.0.0.onnx';
const ZOMBIE_MODEL_URI = '/models/zombie.onnx';
const STRESS_MODEL_URI = '/models/stress/cp-09_loss-0.6800_valloss-0.6840.onnx';

const VPPG_TIME_LEN = 10; // seconds, adjust as needed

const workerAPI = {
  // Load VPPG and Zombie models
  async loadVppgModel(fps: number) {
    let vppgModelUri = VPPG_16FPS_MODEL_URI;
    if (fps >= 28) vppgModelUri = VPPG_30FPS_MODEL_URI;
    else if (fps >= 20) vppgModelUri = VPPG_24FPS_MODEL_URI;
    vppgModel = await ort.InferenceSession.create(vppgModelUri, { executionProviders: ['wasm'] });
    vppgInputNames = vppgModel.inputNames;
    vppgOutputName = vppgModel.outputNames[0];
    if (!zombieModel) {
      zombieModel = await ort.InferenceSession.create(ZOMBIE_MODEL_URI, { executionProviders: ['wasm'] });
    }
    return true;
  },

  // Load Stress model
  async loadStressModel() {
    if (!stressModel) {
      stressModel = await ort.InferenceSession.create(STRESS_MODEL_URI, { executionProviders: ['wasm'] });
      stressInputName = stressModel.inputNames[0];
      stressOutputName = stressModel.outputNames[0];
    }
    return true;
  },

  // Run VPPG inference
  async runVppg(normalizedBatch: number[], rawBatch: number[], dims: number[]) {
    if (!vppgModel) throw new Error('VPPG model not loaded');
    const inputTensorNormalized = new ort.Tensor('float32', normalizedBatch, dims);
    const inputTensorRaw = new ort.Tensor('float32', rawBatch, dims);
    const inputs = {
      [vppgInputNames[0]]: inputTensorNormalized,
      [vppgInputNames[1]]: inputTensorRaw
    };
    const data = await vppgModel.run(inputs);
    const d = await data[vppgOutputName].getData() as Float32Array;
    // Post-process as needed (e.g., filtering, resampling)
    return Array.from(d);
  },

  // Run Zombie detection
  async runZombie(vppgSignal: number[], dims: number[]) {
    if (!zombieModel) throw new Error('Zombie model not loaded');
    const inputTensor = new ort.Tensor('float32', vppgSignal, dims);
    const inputs = { [zombieModel.inputNames[0]]: inputTensor };
    const results = await zombieModel.run(inputs);
    const outputData = await results[zombieModel.outputNames[0]].getData() as Float32Array;
    return outputData[0];
  },

  // Run Stress inference
  async runStress(features: number[]) {
    if (!stressModel) throw new Error('Stress model not loaded');
    const inputTensor = new ort.Tensor('float32', features, [1, features.length]);
    const inputs = { [stressInputName]: inputTensor };
    const result = await stressModel.run(inputs);
    return result[stressOutputName].data[0] as number;
  },

  // Optionally, add more utility methods for feature extraction, filtering, etc.
};

Comlink.expose(workerAPI); 