import { DrawingUtils, FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision"
import cv from "opencv-ts"
import { CubicSpline } from "./interpolation"
import { findPeaks } from "@/util/find_peaks"
import { meanArray, stdArray } from "./array"

export const validateFaceBox = (faceBox: number[], frameShape: number[], padding: number = 0) => {
  if (faceBox.length === 0) {
    return [false, []]
  }
  let [left, top, right, bottom] = faceBox.slice(1)
  if (padding > 0) {
    const currentWidth = right - left
    const currentHeight = bottom - top

    left = Math.floor(left - currentWidth * Math.floor(padding / 2))
    right = Math.floor(right + currentHeight * Math.floor(padding / 2))
    top = Math.floor(top - currentHeight * Math.floor(padding / 2))
    bottom = Math.floor(bottom + currentHeight * Math.floor(padding / 2))
  }

  left = Math.max(0, left)
  top = Math.max(0, top)
  right = Math.min(right, frameShape[0])
  bottom = Math.min(bottom, frameShape[1])

  if (right <= left || bottom <= top) {
    return [false, []]
  }

  return [true, [faceBox[0], left, top, right, bottom]] 
}

export const stabilizeFaceBox = (prevFaceBox: number[], newFaceBox: number[], deltaX = 10, deltaY = 10) => {
  if (prevFaceBox === null || prevFaceBox.length === 0) {
    return newFaceBox
  }

  const [prevLeft, prevTop, prevRight, prevBottom] = prevFaceBox.slice(1)
  const prevCenterX = Math.floor(prevLeft + (prevRight - prevLeft) / 2)
  const prevCenterY = Math.floor(prevTop + (prevBottom - prevTop) / 2)

  const [newLeft, newTop, newRight, newBottom] = newFaceBox.slice(1)
  const newCenterX = Math.floor(newLeft + (newRight - newLeft) / 2)
  const newCenterY = Math.floor(newTop + (newBottom - newTop) / 2)

  if (Math.abs(prevCenterX - newCenterX) >= deltaX || Math.abs(prevCenterY - newCenterY) >= deltaY) {
    return newFaceBox
  } else {
    // Update the face box with new confidence values
    prevFaceBox[0] = newFaceBox[0]
    return prevFaceBox
  }
}

export const stabilizeFaceBoxV2 = (prevStableFaceBox: number[], newFaceBox: number[], mxWidth: number, mxHeight: number, deltaRate = 0.20) => {
  const [left, top, right, bottom] = newFaceBox.slice(1)
  const height = bottom - top
  const width = right - left
  if (prevStableFaceBox.length === 0 || JSON.stringify(prevStableFaceBox) === JSON.stringify([0,0,0,0,0])) {
    const halfPaddingHeight = Math.round(height * (deltaRate / 2))
    const halfPaddingWidth = Math.round(width * (deltaRate / 2))

    prevStableFaceBox[0] = newFaceBox[0]
    prevStableFaceBox[1] = (left - halfPaddingWidth) < 0 ? 0 : left - halfPaddingWidth
    prevStableFaceBox[2] = (top - halfPaddingHeight) < 0 ? 0 : top - halfPaddingHeight
    prevStableFaceBox[3] = (right + halfPaddingWidth) > mxWidth ? mxWidth : right + halfPaddingWidth
    prevStableFaceBox[4] = (bottom + halfPaddingHeight) > mxHeight ? 0 : bottom + halfPaddingHeight
    return prevStableFaceBox
  }

  let [leftS, topS, rightS, bottomS] = prevStableFaceBox.slice(1)
  const heightS = Math.round(height * (1 + deltaRate)) 
  const widthS = Math.round(width * (1 + deltaRate)) 
  if (left < leftS) {
    leftS = left
    rightS = leftS + widthS
  } else if (right > rightS) {
    rightS = right
    leftS = rightS - widthS
  }
  if (top < topS) {
    topS = top
    bottomS = topS + heightS
  } else if (bottom > bottomS) {
    bottomS = bottom
    topS = bottomS - heightS
  }

  prevStableFaceBox[1] = leftS
  prevStableFaceBox[2] = topS
  prevStableFaceBox[3] = rightS
  prevStableFaceBox[4] = bottomS
  return prevStableFaceBox
}

export const drawFaceBox = (canvas: HTMLCanvasElement, faceBox: number[]) => {
  canvas.style.position = "absolute"
  const canvasCtx = canvas.getContext("2d")!
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  const [left, top, right, bottom] = faceBox
  const width = right - left, height = bottom - top
  canvasCtx.beginPath()
  canvasCtx.rect(left, top, width, height);
  canvasCtx.strokeStyle = "#FF0000";
  canvasCtx.lineWidth = 1;
  canvasCtx.stroke();
}

export const drawFaceCenterDot = (canvas: HTMLCanvasElement, x: number, y: number) => {
  canvas.style.position = "absolute"
  const canvasCtx = canvas.getContext("2d")!
  canvasCtx.strokeStyle = "red";
	canvasCtx.fillStyle = "red";
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();
	canvasCtx.arc(x, y, 10, 0, Math.PI*2, true);
	canvasCtx.closePath();
	canvasCtx.fill()
}

export const drawFace = (canvas: HTMLCanvasElement, imageData: ImageData, faceBox: number[], faceMesh: FaceLandmarkerResult|null) => {
  const croppedImage = cropImageData(imageData, faceBox[0], faceBox[1], faceBox[2], faceBox[3])

  canvas.style.position = "absolute"
  canvas.height = croppedImage.height
  canvas.width = croppedImage.width
  const canvasCtx = canvas.getContext("2d")!
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx?.putImageData(croppedImage, 0, 0)
  // if (faceBox !== null) {
  //   const [left, top, width, height] = faceBox
  //   canvasCtx.beginPath()
  //   canvasCtx.rect(left, top, width, height);
  //   canvasCtx.strokeStyle = "#FF0000";
  //   canvasCtx.lineWidth = 1;
  //   canvasCtx.stroke();
  // }
  if (faceMesh !== null) {
    // canvasCtx?.putImageData(croppedImage, 0, 0)
    const drawingUtils = new DrawingUtils(canvasCtx);
    if (faceMesh.faceLandmarks) {
      for (const landmarks of faceMesh.faceLandmarks) {
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {color: '#FF3030'});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {color: '#FF3030'});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, {color: '#FF3030'});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {color: '#30FF30'});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {color: '#30FF30'});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, {color: '#30FF30'});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {color: '#E0E0E0'});
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {color: '#E0E0E0'});
      }
    }
    canvasCtx.restore();
  }
}

export const clearFace = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export const cropImageData = (image: ImageData, left: number, top: number, right: number, bottom: number) => {
  if (!left || !top || !right || !bottom) {
    return image
  }
  left = Math.round(left)
  top = Math.round(top)
  right = Math.round(right)
  bottom = Math.round(bottom)
  const rows = (bottom - top) + 1
  const cols = (right - left) + 1
  const croppedImage = new Uint8ClampedArray(rows * cols * 4)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      croppedImage[(row * cols + col) * 4] = image.data[((row + top) * image.width + col + left) * 4]
      croppedImage[(row * cols + col) * 4 + 1] = image.data[((row + top) * image.width + col + left) * 4 + 1]
      croppedImage[(row * cols + col) * 4 + 2] = image.data[((row + top) * image.width + col + left) * 4 + 2]
      croppedImage[(row * cols + col) * 4 + 3] = image.data[((row + top) * image.width + col + left) * 4 + 3]
    }
  }
  try {
    new ImageData(croppedImage, cols, rows, {colorSpace: image.colorSpace})
  } catch(e) {
    console.log(e)
  }
  return new ImageData(croppedImage, cols, rows, {colorSpace: image.colorSpace})
}

export const resizeImageData = (image: ImageData, newWidth: number, newHeight: number, interpolation=-1) => {
  const imageResized = new cv.Mat()
  const matImage = cv.matFromImageData(image)
  if (interpolation == -1) {
    cv.resize(matImage, imageResized, new cv.Size(newWidth, newHeight))
  } else {
    cv.resize(matImage, imageResized, new cv.Size(newWidth, newHeight), 0, 0, interpolation)
  }
  const resizedImageData = new Uint8ClampedArray(imageResized.data)
  const resizedImage = new ImageData(resizedImageData, newWidth, newHeight, {colorSpace: image.colorSpace})
  
  imageResized.delete()
  matImage.delete()
  
  return resizedImage
}

export const normalizeImageData = (image: ImageData) => {
  const data = image.data
  const normalizedData = data.map(v=>v/255)
  return new ImageData(normalizedData, image.width, image.height, {colorSpace: image.colorSpace})
}

export const maxCenterSquareBox = (frameShape: number[]) => {
  const shorterSide = Math.min(frameShape[0], frameShape[1])
  const centerX = Math.floor(frameShape[1] / 2)
  const centerY = Math.floor(frameShape[0] / 2)

  const left = centerX - Math.floor(shorterSide / 2)
  const top = centerY - Math.floor(shorterSide / 2)
  const right = centerX + Math.floor(shorterSide / 2)
  const bottom = centerY + Math.floor(shorterSide / 2)

  return [left, top, right, bottom]
}

export const convertImageDataToArray = (image: ImageData) => {
  const { data, width, height } = image;
  const result = new Array(height); // Create an array for each row

  for (let y = 0; y < height; y++) {
    result[y] = new Array(width); // Create an array for each pixel in the row
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4; // Each pixel has 4 values: R, G, B, A (RGBA format)
      result[y][x] = [
        data[i],       // Red
        data[i + 1],   // Green
        data[i + 2]    // Blue
      ];
    }
  }

  return result; // 3D array [height][width][RGB]
}

export const cropImageArray = (array: number[][], left: number, top: number, right: number, bottom: number) => {
  const cropped: number[][] = []
  for (let i = top; i < bottom; i++) {
    cropped.push(array[i].slice(left, right))
  }
  return cropped
}

export const vppgFramePrepare = (frame: ImageData, target=36, square=false) => {
  console.log(square)
  // if (square) {
    // Determine the smaller dimension
    // const frameHeight = frame.length
    // const frameWidth = frame[0].length
    // const shorterSide = Math.min(frameHeight, frameWidth)

    // Calculate the cropping coordinates
    // const left = Math.floor((frameWidth - shorterSide) / 2)
    // const top = Math.floor((frameHeight - shorterSide) / 2)
    // const right = left + shorterSide
    // const bottom = top + shorterSide

    // Crop to a square frame
    // const squareFrame = cropImageData(frame, left, top, right, bottom)
  // }
  
  let vidLxL = frame
  // Resize the frame
  vidLxL = resizeImageData(vidLxL, target, target, cv.INTER_AREA)
  // normalize
  // vidLxL = normalizeImageData(vidLxL)
  return convertImageDataToArray(vidLxL).map(v1 => v1.map((v2: number[]) => v2.map((v3: number) => v3 / 255)))
}

export const calculateFeaturesFromVppg = () => {
  //
}

export const clip = (data: number[], limit = 160) => {
  return data.map((value: number) => {
    if (Math.abs(value) > limit) {
      return Math.sign(value) * limit;
    }
    return value;
  })
}

export const movingAverage = (data: number[], window = 3) => {
  const pad = Math.floor(window / 2);
  const maData = new Array(pad).fill(0);

  for (let i = 0; i <= data.length - window; i++) {
      const dataSegment = data.slice(i, i + window);
      const windowAverage = parseFloat((dataSegment.reduce((a, b) => a + b, 0) / window).toFixed(2));
      maData.push(windowAverage);
  }

  for (let p = 0; p < pad; p++) {
      maData[p] = maData[pad];
      maData.push(maData[maData.length - 1]);
  }

  return maData;
}

export const normalizeHeadPose = (data: number[], min: number, max: number, minMp: number, maxMp: number) => {
  data = data.map(value => ((value - minMp) / (maxMp - minMp)) * (-min + max) - max);
  return data;
}

export const detectLongHeadPose = (data: number[], threshold = 6, totalHeadShakes = 0) => {
  const stepSize = 3;
  const derivative = data.slice(stepSize).map((val, i) => val - data[i]);
  const steps = derivative.map((val, i) => Math.abs(val) > threshold ? i : -1).filter(i => i !== -1);
  
  if (steps.length >= 1) {
      const midIndex = Math.floor(steps.length / 2);
      const ix1 = steps[midIndex] - 10;
      const ix2 = steps[midIndex] + 10;
      
      const dataSegments = [
          data.slice(0, Math.max(0, ix1)),
          data.slice(Math.min(ix2, data.length))
      ];
      
      if (dataSegments[0].length === 0 || dataSegments[1].length === 0) {
          return totalHeadShakes;
      }
      
      const stdDevs = dataSegments.map(segment => stdArray(segment, 1));
      const means = dataSegments.map(segment => meanArray(segment, 1));
      
      totalHeadShakes += stdDevs.reduce((count, stdDev, i) => 
          count + (stdDev <= 2 && Math.abs(means[i]) > 20 ? 1 : 0), 0
      );
  }
  
  return totalHeadShakes;
}

export const headShakingCount = (yawData: number[]) => { // save
  if (!yawData || yawData.length < 3) {
    return 0; // Not enough data for cubic interpolation
  }
  // Interpolate to 200 points
  const x = Array.from({ length: yawData.length }, (_, i) => i / (yawData.length - 1));
  const xNew = Array.from({ length: 200 }, (_, i) => i / (200 - 1));

  const spline = new CubicSpline(x, yawData)
  let yawDataInterpolated = spline.interpolateArray(xNew) // save

  yawDataInterpolated = clip(yawDataInterpolated)

  // Smooth data by applying moving average twice.
  let maData = movingAverage(yawDataInterpolated, 10)  // save
  maData = normalizeHeadPose(maData, -60, 60, 30, 150)

  let left = Array.from(maData)
  let right = Array.from(maData)
  left = left.map(value => (value > -15 ? 0 : value))
  right = right.map(value => (value < 15 ? 0 : value))

  left = movingAverage(left, 3)
  right = movingAverage(right, 3)

  const height = 35 // 30
  const prominence = 3
  const distance = 5

  const leftPeaks = findPeaks(
    left.map(v => Math.abs(v)),
    height,
    prominence,
    distance
  ).peaks
  const rightPeaks = findPeaks(
    right,
    height,
    prominence,
    distance
  ).peaks

  const headShakesLeft = leftPeaks.length
  const headShakesRight = rightPeaks.length

  let totalHeadShakes = headShakesLeft + headShakesRight
  if (totalHeadShakes === 0) {
    totalHeadShakes = detectLongHeadPose(left)
    totalHeadShakes += detectLongHeadPose(right)
  }
  return totalHeadShakes // save
}

