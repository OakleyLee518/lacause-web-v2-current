//import stressProcessor from '@/core/processors/stress_processor'
import vppgProcessor from '@/core/processors/vppg_processor'
import poseEstimator from '@/core/processors/pose_predictor_processor'
import faceDetectorProcessor from '@/core/processors/face_detector_processor'
import { AppDispatch } from '@/store/store'

export const LOAD_FACE_DETECT_MODEL_START = 'LOAD_FACE_DETECT_MODEL_START'
export const LOAD_FACE_DETECT_MODEL_SUCCESS = 'LOAD_FACE_DETECT_MODEL_SUCCESS'
export const LOAD_FACE_DETECT_MODEL_FAILED = 'LOAD_FACE_DETECT_MODEL_FAILED'

export const LOAD_VPPG_MODEL_START = 'LOAD_VPPG_MODEL_START'
export const LOAD_VPPG_MODEL_SUCCESS = 'LOAD_VPPG_MODEL_SUCCESS'
export const LOAD_VPPG_MODEL_FAILED = 'LOAD_VPPG_MODEL_FAILED'

export const LOAD_LANDMARK_MODEL_START = 'LOAD_LANDMARK_MODEL_START'
export const LOAD_LANDMARK_MODEL_SUCCESS = 'LOAD_LANDMARK_MODEL_SUCCESS'
export const LOAD_LANDMARK_MODEL_FAILED = 'LOAD_LANDMARK_MODEL_FAILED'

export const LOAD_STRESS_MODEL_START = 'LOAD_STRESS_MODEL_START'
export const LOAD_STRESS_MODEL_SUCCESS = 'LOAD_STRESS_MODEL_SUCCESS'
export const LOAD_STRESS_MODEL_FAILED = 'LOAD_STRESS_MODEL_FAILED'

export const MODEL_READY = 'MODEL_READY'

export const enum ModelState {
  MODEL_NOT_LOAD = 0,
  MODEL_LOADING = 1,
  MODEL_LOADED = 2,
  MODEL_LOAD_FAILED = 3
}

export const loadFaceDetectModel = () => {
  return async (dispatch: AppDispatch) => {
    dispatch({
      type: LOAD_FACE_DETECT_MODEL_START
    })

    faceDetectorProcessor
      .loadModel()
      .then(() => {
        dispatch({
          type: LOAD_FACE_DETECT_MODEL_SUCCESS,
        })
      })
      .catch((error) => {
        console.error('Failed to load faceDetect model:', error)
        dispatch({
          type: LOAD_FACE_DETECT_MODEL_FAILED,
        })
      })
  }
}

export const loadLandmarkModel = () => {
  return async (dispatch: AppDispatch) => {
    dispatch({
      type: LOAD_LANDMARK_MODEL_START,
    })

    try {
      await poseEstimator.loadModel()
      dispatch({
        type: LOAD_LANDMARK_MODEL_SUCCESS,
      })
    } catch (error) {
      console.error('Failed to load landmark model:', error)
      dispatch({
        type: LOAD_LANDMARK_MODEL_FAILED,
      })
    }
  }
}

export const loadVPPGModel = (fps: number) => {
  return (dispatch: AppDispatch) => {
    dispatch({
      type: LOAD_VPPG_MODEL_START,
    })

    vppgProcessor
      .loadModel(fps)
      .then(() => {
        dispatch({
          type: LOAD_VPPG_MODEL_SUCCESS,
        })
      })
      .catch(() => {
        dispatch({
          type: LOAD_VPPG_MODEL_FAILED,
        })
      })
  }
}

export const modelReady = () => {
  return (dispatch: AppDispatch) => {
    dispatch({
      type: MODEL_READY,
    })
  }
}
