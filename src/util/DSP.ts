// @ts-expect-error: Fili has no types, using as any for import
import Fili from 'fili'
import * as waveResampler from 'wave-resampler'
import * as math from 'mathjs'
import { spdiags } from '@/util/mat'
import { CubicSpline } from './interpolation'

const ProcessSignal = (
  samples: number[],
  fs: number,
  new_fs: number,
  w: number,
  s: number
) => {
  const custom_diff = (arrs: number[][]) => {
    return arrs.map((arr: number[]) => {
      let local_res = []
      const l = arr.length
      local_res = arr.slice(0, l - 1).map((value: number, index: number) => {
        return arr[index + 1] - arr[index]
      })
      return local_res
    })
  }

  const custom_np_append = (a: number[][], b: number[][]): number[][] => {
    const result: number[][] = []
    a.forEach((x: number[], i: number) => {
      result.push([...x, ...b[i]])
    })
    return result
  }

  const custom_np_dstack = (a: number[][], b: number[][]): number[][][] => {
    const result: number[][][] = []
    a.forEach((x: number[], i: number) => {
      const local: number[][] = []
      x.forEach((_, j: number) => {
        local.push([a[i][j], b[i][j]])
      })
      result.push(local)
    })
    return result
  }

  const new_data: number[] = Array.from(waveResampler.resample(samples, fs, new_fs, {
    method: 'linear',
  }))

  const sliced_data: number[][] = []
  const total_step = new_data.length - w * new_fs
  for (let i = 0; i < total_step; i = i + new_fs * s) {
    sliced_data.push(new_data.slice(i, i + w * new_fs))
  }

  const diff_x = custom_diff(sliced_data)

  // Guarantee sliced_data_reshaped is number[][] and matches diff_x shape
  const reshaped = math.reshape(
    sliced_data.map((x: number[]) => x[0]),
    [-1, 1]
  );
  let sliced_data_reshaped: number[][];
  if (Array.isArray(reshaped)) {
    if (reshaped.length === 0) {
      sliced_data_reshaped = [];
    } else if (typeof reshaped[0] === 'number') {
      // Flat array, wrap each element
      sliced_data_reshaped = (reshaped as number[]).map((v) => [v]);
    } else if (Array.isArray(reshaped[0])) {
      // Array of arrays, ensure each row is a number[]
      sliced_data_reshaped = (reshaped as unknown as Array<unknown>).map((row) => Array.from(row as ArrayLike<number>));
    } else {
      throw new Error('Unexpected shape from math.reshape');
    }
  } else {
    throw new Error('math.reshape did not return an array');
  }
  let sliced_data_reshaped_final = sliced_data_reshaped;
  let diff_x_final = diff_x;
  if (sliced_data_reshaped.length > diff_x.length) {
    sliced_data_reshaped_final = sliced_data_reshaped.slice(0, diff_x.length);
  } else if (diff_x.length > sliced_data_reshaped.length) {
    diff_x_final = diff_x.slice(0, sliced_data_reshaped.length);
  }
  const diff_sliced_data = custom_np_append(sliced_data_reshaped_final, diff_x_final);
  // Ensure sliced_data and diff_sliced_data have the same length
  let sliced_data_for_stack = sliced_data;
  let diff_sliced_data_final = diff_sliced_data;
  if (sliced_data_for_stack.length > diff_sliced_data.length) {
    sliced_data_for_stack = sliced_data_for_stack.slice(0, diff_sliced_data.length);
  } else if (diff_sliced_data.length > sliced_data_for_stack.length) {
    diff_sliced_data_final = diff_sliced_data.slice(0, sliced_data_for_stack.length);
  }
  const full_data = custom_np_dstack(sliced_data_for_stack, diff_sliced_data_final);
  return full_data
}

const iirCalculator = new Fili.CalcCascades()
const iirFilterCoeffs = iirCalculator.bandpass({
  order: 1, // cascade 3 biquad filters (max: 12)
  characteristic: 'butterworth',
  Fs: 30, // sampling frequency
  Fc: 1.375, // (2.5-0.75) / 2 + 0.75, 2.5 --> 150/60, 0.75 --> 45/60 # 1.625
  BW: 1.25, // 2.5 - 0.75 = 1.75
  gain: 0, // gain for peak, lowshelf and highshelf
  preGain: false, // adds one constant multiplication for highpass and lowpass
})
export const newIirFilterWithFs = (fs: number) => {
  return new Fili.IirFilter(iirCalculator.bandpass({
    order: 1, // cascade 3 biquad filters (max: 12)
    characteristic: 'butterworth',
    Fs: fs, // sampling frequency
    Fc: 1.625, // (2.5-0.75) / 2 + 0.75, 2.5 --> 150/60, 0.75 --> 45/60 # 1.625
    BW: 1.75, // 2.5 - 0.75 = 1.75
    gain: 0, // gain for peak, lowshelf and highshelf
    preGain: false, // adds one constant multiplication for highpass and lowpass
  }))
}
const iirFilter = new Fili.IirFilter(iirFilterCoeffs)

export { iirFilter, ProcessSignal }

export const detrend = (signal: number[], Lambda: number) => {
  const signalLength = signal.length

  // observation matrix
  const H = math.identity(signalLength)

  // second-order difference matrix
  const ones = Array(signalLength).fill(1)
  const minusTwos = Array(signalLength).fill(-2)
  const diagsData = [ones, minusTwos, ones]
  const diagsIndex = [0, 1, 2]
  const D = spdiags(diagsData, diagsIndex, signalLength - 2, signalLength)
  const filter = math.subtract(
    H, 
    math.inv(
      math.add(
        H, 
        math.multiply(
          Lambda ** 2, 
          math.multiply(
            math.transpose(D), 
            D
          )
        )
      )
    )
  )
  const filteredSignal = math.multiply(filter, signal)
  return filteredSignal.toArray() as number[]
}

export const resample = (data: number[], oldTs: number, newTs: number) => {
  // Kaiser Filter constants
  let fc = 0.9
  let df = 0.2

  // Find best ratio
  const [p, q] = rat(newTs / oldTs, 1e-12)
  let nyq
  if (p < q) {
    nyq = p / q
  } else {
    nyq = q / p
  }
  fc *= nyq  // Anti-aliasing filter cutoff frequency
  df *= nyq  // Anti-aliasing filter transition band width

  const m = kaiserOrder(0.002, df)

  const b = kaiserFilter(m + 1, fc)
  // Down sampling anti-aliasing filter
  if (p < q) {
    data = firfiltdcpadded(b, data)
  }

  // Spline Interpolation
  const dataX = Array.from({ length: data.length }, (_, i) => i)
  const newPoints = Math.ceil(data.length * p / q)
  const dd = p / q
  const xx = Array.from({ length: newPoints }, (_, i) => i / dd)

  const spline = new CubicSpline(dataX, data)
  let yy = spline.interpolateArray(xx) 

  // Upsampling, anti-imaging filter
  if (p > q) {
    yy = firfiltdcpadded(b, yy)
  }

  return yy
}

export const rat = (num: number, tol: number) => {
  let x = num
  let p, q
  if (!isFinite(x)) {
    if (isNaN(x)) {
      p = Math.sign(x)
    } else {
      p = 0
    }
    q = 0
  } else {
    const C = [1, 0, 0, 1]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-const
    let k = 1;
    while (true) {
      const d = Math.round(x)
      if (isFinite(x)) {
        x = x - d
        const C0t = C[0]
        const C2t = C[2]
        C[0] = C[0] * d + C[1]
        C[2] = C[2] * d + C[3]
        C[1] = C0t
        C[3] = C2t
      } else {
        const C0t = C[0]
        const C2t = C[2]
        C[0] = x
        C[2] = 0
        C[1] = C0t
        C[3] = C2t
      }
      if (x === 0 || Math.abs(C[0] / C[2] - num) <= tol) {
        break;
      }
      x = 1 / x
    }
    p = C[0] / Math.sign(C[2]);
    q = Math.abs(C[2]);
  }
  return [p, q]
}

export const kaiserOrder = (ripple: number, width: number) => {
  const devdb = -20.0 * Math.log10(ripple)
    let m = 1 + (devdb - 8) / (2.285 * 2 * Math.PI * width)
    m = Math.ceil(m / 2) * 2
    return Math.round(m)
}

// Function to calculate the zeroth-order modified Bessel function (I₀)
export const besselI0 = (x: number) => {
  let sum = 1.0;
  let term = 1.0;
  let k = 1;
  const epsilon = 1e-8; // Small value for convergence
  
  // Calculate series expansion until terms become sufficiently small
  while (term > sum * epsilon) {
      term *= (x * x) / (4 * k * k);
      sum += term;
      k++;
  }
  
  return sum;
}

// Kaiser window function implementation
export const kaiser = (length: number, beta: number) => {
  // Check for valid input
  if (!Number.isInteger(length) || length <= 0) {
      throw new Error('Window length must be a positive integer');
  }
  if (typeof beta !== 'number' || beta < 0) {
      throw new Error('Beta must be a non-negative number');
  }

  // Array to store window coefficients
  const window = new Array(length);
  
  // Pre-calculate I₀(β) for normalization
  const i0Beta = besselI0(beta);
  
  // Calculate window coefficients
  for (let n = 0; n < length; n++) {
      // Calculate the argument for I₀
      const term = (2 * n) / (length - 1) - 1;
      const arg = beta * Math.sqrt(1 - term * term);
      
      // Kaiser window formula: w[n] = I₀(β * sqrt(1 - ((2n)/(N-1) - 1)²)) / I₀(β)
      window[n] = besselI0(arg) / i0Beta;
  }
  
  return window;
}

export const kaiserFilter = (m: number, fc: number) => {
  const wb = kaiser(m, 5)
  fc /= 2
  return fkernel(m, fc, wb)
}

export const fkernel = (m: number, f: number, w: number[]) => {
  const b = new Array(m);
  let bsum = 0;
  let n = Math.floor(-(m - 1) / 2);

  for (let i = 0; i < m; i++) {
      if (n === 0) {
          b[i] = 2 * Math.PI * f;
      } else {
          b[i] = Math.sin(2 * Math.PI * f * n) / n;
      }
      bsum += b[i];
      n++;
  }

  for (let i = 0; i < m; i++) {
      b[i] *= w[i];
      b[i] /= bsum;
  }

  return b;
}

export const firfiltdcpadded = (b: number[], data: number[], causal = 0) => {
  // Filter's Group delay
  const groupDelay = Math.floor((b.length - 1) / 2);
  
  // Pad with DC constant
  let startPad, endPad;
  
  if (causal === 1) {
    startPad = Array(2 * groupDelay).fill(data[0]);
    endPad = [];
  } else {
    startPad = Array(groupDelay).fill(data[0]);
    endPad = Array(groupDelay).fill(data[data.length - 1]);
  }
  
  const padVec = [...startPad, ...data, ...endPad];
  
  // Filter data
  data = lfilter(b, [1], padVec);
  
  // Remove padded data
  data = data.slice(2 * groupDelay);
  
  return data;
}

export const lfilter = (b: number[], a: number[], x: number[]) => {
  const y = new Array(x.length).fill(0);
  for (let n = 0; n < x.length; n++) {
    for (let k = 0; k < b.length; k++) {
      if (n - k >= 0) y[n] += b[k] * x[n - k];
    }
    // For IIR, subtract feedback terms using 'a' coefficients
    for (let k = 1; k < a.length; k++) {
      if (n - k >= 0) y[n] -= a[k] * y[n - k];
    }
  }
  return y;
}

export const signalSmooth = (signal: number[], method="convolution", kernel="boxzen", size=10, alpha=0.1) => {
  let smoothed = []
  console.log('signalSmooth',alpha)
  if (method === "convolution") {
    if (kernel == "boxcar") {
      smoothed = uniformFilter1d(signal, size, "nearest")
    } else {
      // implement in the feature
    }
  } else {
    // implement in the feature
  }
  return smoothed
}

export function uniformFilter1d(signal: number[], size: number, mode = 'reflect') {
  /**
   * Applies a 1D uniform filter (moving average) to the input signal
   * @param {number[]} signal - Input 1D array to filter
   * @param {number} size - Size of the moving window (must be odd)
   * @param {string} mode - Boundary handling mode: 'reflect', 'constant', 'nearest', 'mirror', 'wrap'
   * @returns {number[]} Filtered signal
   */

  // Validate inputs
  if (!Array.isArray(signal) || signal.length === 0) {
      throw new Error('Signal must be a non-empty array');
  }
  if (!Number.isInteger(size) || size <= 0) {
      throw new Error('Size must be a positive integer');
  }
  if (size % 2 === 0) {
    if (size > 1) {
      size--
    } else {
      size++
    }
      // throw new Error('Size must be odd');
  }

  const halfSize = Math.floor(size / 2);
  const output = new Array(signal.length);
  const windowSum = [];
  let sum = 0;

  // Handle different boundary modes
  function getValue(index: number) {
      if (index >= 0 && index < signal.length) {
          return signal[index];
      }

      switch (mode) {
          case 'constant':
              return 0;
          case 'nearest':
              return signal[index < 0 ? 0 : signal.length - 1];
          case 'reflect':
              return signal[index < 0 ? -index - 1 : 2 * signal.length - index - 1];
          case 'mirror':
              return signal[index < 0 ? -index : 2 * signal.length - index - 2];
          case 'wrap':
              return signal[(index % signal.length + signal.length) % signal.length];
          default:
              throw new Error('Unsupported mode');
      }
  }

  // Initial window sum
  for (let i = -halfSize; i <= halfSize; i++) {
      sum += getValue(i);
      windowSum.push(getValue(i));
  }
  output[0] = sum / size;

  // Slide window across signal
  for (let i = 1; i < signal.length; i++) {
      // Remove leftmost value and add rightmost value
      let v = windowSum.shift()
      v = (v === undefined ? 0 : v)
      sum -= v;
      const newVal = getValue(i + halfSize);
      sum += newVal;
      windowSum.push(newVal);
      output[i] = sum / size;
  }

  return output;
}

export const diff = (arr:number[]|null, nDiff=1) => {
  if (arr === null) {
    return []
  }

  if (nDiff < 1) return arr;

  let diffArr = arr;
  for (let n = 0; n < nDiff; n++) {
    diffArr = diffArr.slice(1).map((val, i) => val - diffArr[i]);
  }
  
  return diffArr
}