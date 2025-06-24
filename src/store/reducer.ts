import { ModelState } from '@/store/actions/model'

import {
  LOAD_FACE_DETECT_MODEL_START,
  LOAD_FACE_DETECT_MODEL_SUCCESS,
  LOAD_FACE_DETECT_MODEL_FAILED,
  LOAD_LANDMARK_MODEL_FAILED,
  LOAD_LANDMARK_MODEL_START,
  LOAD_LANDMARK_MODEL_SUCCESS,
  LOAD_VPPG_MODEL_START,
  LOAD_VPPG_MODEL_SUCCESS,
  LOAD_VPPG_MODEL_FAILED,
  MODEL_READY,
} from '@/store/actions/model'

import {
  EMOTION_CHANGE,
  USER_LOGIN_FAILED,
  USER_LOGIN_START,
  USER_LOGIN_SUCCESS,
  USER_LOGOUT,
} from '@/store/actions/user'

import { UPDATE_IOT_CONNECTION_STATUS } from '@/store/actions/iot'

import {
  START_CAPTURE,
  START_STOP_BTN,
  STOP_CAPTURE,
  UPDATE_WEBCAM_STATUS,
} from '@/store/actions/camera'

export type AWSUserInfo = {
  email: string
  id: string
  username: string
  attributes: {
    ['custom:admin']: string
    ['custom:company']: string
    ['custom:mode']: string
    ['custom:subject_id2']: string
    email: string
    email_verified: boolean
    sub: string
  }
}

const initialState = {
  isCameraReady: false,
  isLogin: false,
  loginLoading: false,
  loginFailed: false,
  faceDetectModelStatus: ModelState.MODEL_NOT_LOAD,
  landmarkModelStatus: ModelState.MODEL_NOT_LOAD,
  vppgModelStatus: ModelState.MODEL_NOT_LOAD,
  isCaptureReady: false,
  isCapturing: false,
  webcamStatus: false,
  user: {} as AWSUserInfo['attributes'],
  iotConnectionStatus: false,
  latestEmotion: 999,
}
type State = typeof initialState

export const rootReducer = (
  state: State = initialState,
  action: { type: string; data?: unknown }
): State => {
  switch (action.type) {
    case LOAD_FACE_DETECT_MODEL_START:
      return {
        ...state,
        ...{ faceDetectModelStatus: ModelState.MODEL_LOADING }
      }

    case LOAD_FACE_DETECT_MODEL_SUCCESS:
      return {
        ...state,
        ...{ faceDetectModelStatus: ModelState.MODEL_LOADED }
      }

    case LOAD_FACE_DETECT_MODEL_FAILED:
      return {
        ...state,
        ...{ faceDetectModelStatus: ModelState.MODEL_LOAD_FAILED }
      }

    case LOAD_LANDMARK_MODEL_START:
      return {
        ...state,
        ...{ landmarkModelStatus: ModelState.MODEL_LOADING },
      }

    case LOAD_LANDMARK_MODEL_SUCCESS:
      return {
        ...state,
        ...{ landmarkModelStatus: ModelState.MODEL_LOADED },
      }

    case LOAD_LANDMARK_MODEL_FAILED:
      return {
        ...state,
        ...{ landmarkModelStatus: ModelState.MODEL_LOAD_FAILED },
      }

    case LOAD_VPPG_MODEL_START:
      return {
        ...state,
        ...{ vppgModelStatus: ModelState.MODEL_LOADING },
      }

    case LOAD_VPPG_MODEL_SUCCESS:
      return {
        ...state,
        ...{ vppgModelStatus: ModelState.MODEL_LOADED },
      }

    case LOAD_VPPG_MODEL_FAILED:
      return {
        ...state,
        ...{ vppgModelStatus: ModelState.MODEL_LOAD_FAILED },
      }

    case MODEL_READY:
      return {
        ...state,
        ...{ isCaptureReady: true },
      }

    case USER_LOGIN_START:
      return {
        ...state,
        ...{
          user: action.data as AWSUserInfo['attributes'],
          isLogin: false,
          loginLoading: true,
          loginFailed: false,
        },
      }

    case USER_LOGIN_SUCCESS:
      return {
        ...state,
        ...{ user: action.data as AWSUserInfo['attributes'], isLogin: true, loginLoading: false },
      }

    case USER_LOGIN_FAILED:
      return {
        ...state,
        ...{
          user: {} as AWSUserInfo['attributes'],
          isLogin: false,
          loginLoading: false,
          loginFailed: true,
        },
      }

    case USER_LOGOUT:
      return {
        ...state,
        ...{
          user: {} as AWSUserInfo['attributes'],
          isLogin: false,
          isCapturing: false,
          latestEmotion: 999,
        },
      }

    case START_STOP_BTN:
      return {
        ...state,
        ...{ isCameraReady: action.data as boolean },
      }

    case UPDATE_WEBCAM_STATUS:
      return {
        ...state,
        ...{ webcamStatus: action.data as boolean },
      }

    case UPDATE_IOT_CONNECTION_STATUS:
      return {
        ...state,
        ...{ iotConnectionStatus: action.data as boolean },
      }

    case EMOTION_CHANGE:
      return {
        ...state,
        ...{ latestEmotion: action.data as number },
      }

    case START_CAPTURE:
      return {
        ...state,
        ...{ isCapturing: true },
      }

    case STOP_CAPTURE:
      return {
        ...state,
        ...{ isCapturing: false },
      }

    default:
      return state
  }
}