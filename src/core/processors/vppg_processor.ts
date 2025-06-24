import { VPPG_16FPS_MODEL_URI, VPPG_24FPS_MODEL_URI, VPPG_30FPS_MODEL_URI, VPPG_FINAL_SAMPLING_RATE, VPPG_FRAME_DIM, VPPG_TIME_LEN } from "@/constant";
import * as ort from 'onnxruntime-web';
import { FrameStoreInterface } from "@/core/stores/frame_store";
import frameStore from '@/core/stores/frame_store'
import attentionStore, { AttentionData } from "@/core/stores/attention_store";
import { tensor } from "@tensorflow/tfjs";
import { meanArray, operate3DArray, operate4DArray, stdArray } from "@/util/array";
import { newIirFilterWithFs, resample } from "@/util/DSP";

// FIXED: Updated field names to match Lambda expectations
export interface ForecastData {
  user_id: string; // This will be the user's email
  company_id: string;
  solution: 'camera' | 'video';  
  timestamp: number; // Now unix epoch time in ms
  vppg_signal: number[];
  processed_fps: number;  // FIXED: Changed from 'fps' to 'processed_fps'
  zombie_score: number;   // FIXED: Changed from 'zombie' to 'zombie_score' and must be number, not null
  present_time: number;          // Fraction of time faces were present
  head_shakes: number;    // FIXED: Changed from 'number_of_head_shakes' to 'head_shakes'
  attention: number;             // Attention score from calc_attention.py
  face_down: string;             // Added
  brightness_level: number;      // Added
}

class VppgProcessor {
  model: ort.InferenceSession | null;
  zombieModel: ort.InferenceSession | null;  // Added: Zombie model
  inputName0: string;
  inputName1: string;
  labelName: string;
  frameStore: FrameStoreInterface;
  frameDepth = 10
  VPPG_30FPS_LIMITS = [28, 30]
  VPPG_24FPS_LIMITS = [20, 27]
  VPPG_16FPS_LIMITS = [10, 19]
  
 // Added: Store relevant parameters
  private currentFps: number = 30;  // Keep for model selection
  private pulsePred: number[] = [];  // Store pulse_pred signal (matches Python variable name)
  private lastZombieScore: number = 0.5;  
  private currentPresentTime: number = 0.0;  // Added: Store present time
  private currentHeadShakes: number = 0;      // Added: Store head shakes count
  private currentAttentionScore: number = 0.0; // Added: Store attention score
  private email: string = '';
  private company: string = '';

  constructor(frameStore: FrameStoreInterface) {
    this.model = null;
    this.zombieModel = null;  // Added: Initialize Zombie model
    this.inputName0 = '';
    this.inputName1 = '';
    this.labelName = '';
    this.frameStore = frameStore;
  }

  loadModel = async (fps: number) => {
    this.currentFps = fps;  // Added: Record FPS for model selection
    
    if (this.model === null) {
      const options = {
        executionProviders: ['wasm'], // error for cpu
      };

      let vppgModelUri = VPPG_16FPS_MODEL_URI
      let msg = ""
      if (fps >= this.VPPG_30FPS_LIMITS[0]) {
        vppgModelUri = VPPG_30FPS_MODEL_URI
        msg = "30"
      } else if (this.VPPG_24FPS_LIMITS[0] <= fps && fps <= this.VPPG_24FPS_LIMITS[1]) {
        vppgModelUri = VPPG_24FPS_MODEL_URI
        msg = "24"
      } else {
        vppgModelUri = VPPG_16FPS_MODEL_URI
        msg = "16"
      }

      this.model = await ort.InferenceSession.create(vppgModelUri, options);
      this.inputName0 = this.model.inputNames[0];
      this.inputName1 = this.model.inputNames[1];
      this.labelName = this.model.outputNames[0];
      console.log(`vppgModel_${msg}fps loaded succesfully`)
    }
    
    // Added: Load Zombie model
    if (this.zombieModel === null) {
      try {
        const zombieOptions = {
          executionProviders: ['wasm'],
        };
        this.zombieModel = await ort.InferenceSession.create('/models/zombie.onnx', zombieOptions);
        console.log('Zombie model loaded successfully');
      } catch (error) {
        console.error('Failed to load Zombie model:', error);
      }
    }
    
    return true
  }

  estimateBatch = async (input1: number[][], input2: number[][]) => {
    if (this.model === null) {
      throw new Error('vppgModel not loaded')
    }
    const normalizedBatchData = input1.flat(3)
    const rawBatchData = input2.flat(3)
    const inputTensorNormalized = new ort.Tensor('float32', normalizedBatchData, [input1.length, VPPG_FRAME_DIM, VPPG_FRAME_DIM, 3])
    const inputTensorRaw = new ort.Tensor('float32', rawBatchData, [input2.length, VPPG_FRAME_DIM, VPPG_FRAME_DIM, 3])
    const inputs = { 
      [this.inputName0]: inputTensorNormalized,
      [this.inputName1]: inputTensorRaw
    }
    await this.model.run(inputs).then(async data => { 
      console.log(data)
      const d = await data[this.labelName].getData() as Float32Array
      //console.log(d)
      const shape = data[this.labelName].dims as number[]
      //console.log(shape)

      //VPPG for Zombie
      const tmp = Array.from(tensor(d, shape).dataSync())
      
      // Modified: Only use pulse_pred signal, no resampling
      const pulsePred = this.postProcess(tmp);
      this.pulsePred = pulsePred;  // Store pulse_pred signal
      
      const zombieScore = await this.runZombieDetection(tmp);
      this.lastZombieScore = zombieScore; 
      
      // Added: Update attention metrics from attention store before generating forecast
      this.updateAttentionMetricsFromStore();
      
      this.frameStore.addRawRppgPltData(tmp)
      this.frameStore.addRppgPltData(pulsePred)  // Use pulse_pred for display too
      
    }).catch((e)=>{
      console.log(e)
    }).finally(()=>{
      inputTensorNormalized.dispose()
      inputTensorRaw.dispose()
    })
  }
  
  //Modified: Only filter, no resampling
  postProcess = (rawVppg: number[]) => {
    const fsOld = rawVppg.length / VPPG_TIME_LEN
    
    const iirFilter = newIirFilterWithFs(fsOld)
    const pulsePred = iirFilter.filtfilt(rawVppg)  //pulse_pred in Python
    
    // Return pulse_pred directly (no resampling)
    return pulsePred 
  }

  runZombieDetection = async (vppgSignal: number[]): Promise<number> => {
    if (!this.zombieModel) {
      console.warn('Zombie model not loaded, returning default score');
      return 0.5;
    }

    try {
      //Get VPPG original signal
      const pulseData = vppgSignal;
      const fsOld = pulseData.length / VPPG_TIME_LEN;
      const iirFilter = newIirFilterWithFs(fsOld);
      const filteredPulse = iirFilter.filtfilt(pulseData);

      const resampledPulse = resample(filteredPulse, fsOld, VPPG_FINAL_SAMPLING_RATE);
      
      const mean = meanArray(resampledPulse, 1);
      const std = stdArray(resampledPulse, 1);
      const normalizedPulse = resampledPulse.map((v: number) => (v - mean) / std);
  
      const inputTensor = new ort.Tensor('float32', normalizedPulse, [1, normalizedPulse.length, 1]);
      const inputs = { [this.zombieModel.inputNames[0]]: inputTensor };

      const results = await this.zombieModel.run(inputs);
      const outputData = await results[this.zombieModel.outputNames[0]].getData() as Float32Array;

      const zombieScore = outputData[0];
      
      inputTensor.dispose();
    
      return Math.max(0, Math.min(1, zombieScore));
      
    } catch (error) {
      console.error('Zombie detection failed:', error);
      return 0.5;
    }
  }

  //==============================================================================================================================================
  // Added: present time from attention store data,Head shaking count calculation using yaw data from attention store, Attention score calculation from Python
  //==============================================================================================================================================
  
  // Calculate present time from attention store data
  private calcPresentTimeFromStore = (attentionData: AttentionData[]): number => {
    if (attentionData.length === 0) return 0;
    const presence: number[] = attentionData.map((data: AttentionData) => data.face > 0 ? 1 : 0);
    return presence.reduce((sum: number, val: number) => sum + val, 0) / presence.length;
  }

  // Moving average calculation
  private movingAverage = (data: number[], window: number = 3): number[] => {
    const pad = Math.floor(window / 2);
    const maData: number[] = new Array(pad).fill(0);
    
    for (let i = 0; i <= data.length - window; i++) {
      const segment = data.slice(i, i + window);
      const average = segment.reduce((sum: number, val: number) => sum + val, 0) / window;
      maData.push(Math.round(average * 100) / 100);
    }
    
    // Fill padding
    for (let p = 0; p < pad; p++) {
      if (maData.length > pad) {
        maData[p] = maData[pad];
        maData.push(maData[maData.length - 1]);
      }
    }
    
    return maData;
  }

  // Head shaking count calculation using yaw data from attention store
  private headShakingCountFromStore = (attentionData: AttentionData[]): number => {
    if (attentionData.length < 10) return 0; // Need sufficient data
    
    try {
      // Extract yaw values from attention data
      const yawData: number[] = attentionData
        .map((data: AttentionData) => data.yaw)
        .filter((yaw: number) => !isNaN(yaw));
      
      if (yawData.length < 10) return 0;
      
      // Apply smoothing (simplified version of Python implementation)
      const smoothed = this.movingAverage(yawData, 6);
      
      // Count significant direction changes as head shakes
      let headShakes = 0;
      let lastDirection = 0;
      
      for (let i = 1; i < smoothed.length; i++) {
        const diff = smoothed[i] - smoothed[i - 1];
        const currentDirection = Math.sign(diff);
        
        if (Math.abs(diff) > 5 && currentDirection !== lastDirection && lastDirection !== 0) {
          headShakes++;
        }
        
        if (Math.abs(diff) > 2) {
          lastDirection = currentDirection;
        }
      }
      
      return Math.floor(headShakes / 2); // Each shake involves two direction changes
    } catch (error) {
      console.error('Head shake calculation error:', error);
      return 0;
    }
  }

  // Attention score calculation 
  private calculateAttentionScore = (presentTime: number, headShakes: number): number => {
    const halfPoint = 5;
    try {
      const attentionScore = presentTime * (1 + Math.exp(-halfPoint)) / 
                           (1 + Math.exp(headShakes - halfPoint * presentTime));
      return Math.max(0, Math.min(1, attentionScore)); // Clamp between 0 and 1
    } catch (error) {
      console.error('Attention score calculation error:', error);
      return 0.5; // Default value
    }
  }

  // Added: Method to update attention metrics using attentionStore data
  updateAttentionMetricsFromStore = (timeWindowMs: number = 10000) => {
    try {
      // Get recent attention data from the store
      // If attentionStore doesn't have getRecentData method, we'll get all data and filter
      let recentData: AttentionData[];
      
      if (typeof (attentionStore as unknown as { getRecentData?: (ms: number) => AttentionData[] }).getRecentData === 'function') {
        recentData = (attentionStore as unknown as { getRecentData: (ms: number) => AttentionData[] }).getRecentData(timeWindowMs);
      } else {
        // Fallback: get all data and filter by time window
        const currentTime = new Date().getTime();
        const allData: AttentionData[] = typeof (attentionStore as unknown as { getData?: () => AttentionData[] }).getData === 'function' 
          ? (attentionStore as unknown as { getData: () => AttentionData[] }).getData() 
          : [];
        recentData = allData.filter((data: AttentionData) => 
          currentTime - data.time <= timeWindowMs
        );
      }
      
      if (recentData.length > 0) {
        // Debug: log the window for present_time calculation
        const face0 = recentData.filter(d => d.face === 0).length;
        const face1 = recentData.filter(d => d.face === 1).length;
        console.log(`[DEBUG] updateAttentionMetricsFromStore window: face=0: ${face0}, face=1: ${face1}, present_time: ${face1 / recentData.length}`);
        // Calculate present time (fraction of time faces were detected)
        this.currentPresentTime = this.calcPresentTimeFromStore(recentData);
        
        // Calculate head shakes count
        this.currentHeadShakes = this.headShakingCountFromStore(recentData);
        
        // Calculate attention score
        this.currentAttentionScore = this.calculateAttentionScore(
          this.currentPresentTime, 
          this.currentHeadShakes
        );
        
        console.log('Updated attention metrics:', {
          presentTime: this.currentPresentTime,
          headShakes: this.currentHeadShakes,
          attentionScore: this.currentAttentionScore
        });
      }
    } catch (error) {
      console.error('Error updating attention metrics from store:', error);
      // Keep previous values as fallback
    }
  }

  // FIXED: Updated field names and ensured real values
  private generateForecastData = (pulsePred: number[], zombieScore: number, frameFps: number): ForecastData => {
    const now = new Date();
    const timestamp = now.getTime(); // unix epoch ms

    // FIXED: Ensure user_id is not empty
    const userId = this.userId || `session_${Date.now()}`;
    const companyId = this.companyId || 'unknown_company';

    return {
      user_id: userId,  // FIXED: Ensure not empty
      company_id: companyId, // FIXED: Ensure not empty
      solution: 'video', 
      timestamp: timestamp,
      vppg_signal: pulsePred,  // FIXED: Now uses real pulse_pred data
      processed_fps: (frameFps == null || isNaN(frameFps)) ? 0 : frameFps,
      zombie_score: (zombieScore == null || isNaN(zombieScore)) ? 0.5 : zombieScore,
      present_time: (this.currentPresentTime == null || isNaN(this.currentPresentTime)) ? 0 : this.currentPresentTime,        
      head_shakes: (this.currentHeadShakes == null || isNaN(this.currentHeadShakes)) ? 0 : this.currentHeadShakes,
      attention: (this.currentAttentionScore == null || isNaN(this.currentAttentionScore)) ? 0 : this.currentAttentionScore,  
      face_down: 'False',                            // Added constant
      brightness_level: 11.0                         // Added constant
    };
  }

  // Added: Get userId and companyId method (Need to be confirmed)
  setUserInfo = (userEmail: string, companyId: string) => {
    this.userId = userEmail;
    this.companyId = companyId;
  }

  private userId: string = '';
  private companyId: string = '';

  // Accepts timesec in ms (not seconds)
  computeBatch = async (timesec: number) => {
    const buff = this.frameStore.getFramesSince(timesec)
    //console.log("VPPG Buffer Details:", {
    //  originalBuffLength: buff.length,
    //  timesecRequested: timesec, // ms
    //  timeWindow: (Date.now() - timesec) / 1000 + "s"
    //})
    if (buff.length === 0) {
      return
    }
    
    let XSub = new Array(buff.length)
    for (let i = 0; i < XSub.length; i++) {
      XSub[i] = buff[i].slice()
    }
    
    // Normalized Frames in the motion branch
    const normalizedLen = buff.length - 1
    console.log("After normalization:", normalizedLen)

    let dXSub = new Array(normalizedLen)
    for (let i = 0; i < normalizedLen; i++) {
      dXSub[i] = operate3DArray(operate3DArray(XSub[i+1], XSub[i], "-"), operate3DArray(XSub[i+1], XSub[i], "+"), "/")
    }

    dXSub = operate4DArray(dXSub, stdArray(dXSub, 4), "/")

    // Normalize raw frames in the apperance branch
    XSub = operate4DArray(operate4DArray(XSub, meanArray(XSub, 4), "-"), stdArray(XSub, 4), "/")
    XSub = XSub.slice(0, buff.length - 1)

    const dXSubLen = Math.floor(dXSub.length / this.frameDepth) * this.frameDepth
    console.log("After batch truncation:", dXSubLen, "frameDepth:", this.frameDepth)
    
    dXSub = dXSub.slice(0, dXSubLen)
    XSub = XSub.slice(0, dXSubLen)
    
    console.log("Final processing lengths:", {
      dXSub: dXSub.length,
      XSub: XSub.length,
      totalFramesLost: buff.length - dXSub.length
    })
    
    await this.estimateBatch(dXSub, XSub)
  }

  // Modified: Accept frameFps parameter to send frame_buffer_fps to AWS
  getLatestForecastData = (frameFps: number): ForecastData | null => {
    if (this.pulsePred.length === 0) {
      console.warn('No pulse prediction data available');
      return null;
    }
    
    // Update attention metrics before generating forecast data
    this.updateAttentionMetricsFromStore();
    
    return this.generateForecastData(this.pulsePred, this.lastZombieScore, frameFps);
  }

  // Allow external setting of attention metrics
  public setAttentionMetrics(presentTime: number, headShakes: number, attentionScore: number) {
    this.currentPresentTime = presentTime;
    this.currentHeadShakes = headShakes;
    this.currentAttentionScore = attentionScore;
  }
}

const vppgProcessor = new VppgProcessor(frameStore)
export default vppgProcessor