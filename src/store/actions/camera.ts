import { AppDispatch } from "@/store/store"

export const START_STOP_BTN = 'START_STOP_BTN'
export const UPDATE_WEBCAM_STATUS = 'UPDATE_WEBCAM_STATUS'
export const START_CAPTURE = 'START_CAPTURE'
export const STOP_CAPTURE = 'STOP_CAPTURE'

export const startStop = (capture: boolean) => {
  return async (dispatch: AppDispatch) => {
    dispatch({
      type: START_STOP_BTN,
      data: capture,
    })
  }
}

export const changeWebcamStatus = (isWorking: boolean) => {
  return async (dispatch: AppDispatch) => {
    dispatch({
      type: UPDATE_WEBCAM_STATUS,
      data: isWorking,
    })
  }
}

export const startCapture = () => {
  return async (dispatch: AppDispatch) => {
    dispatch({
      type: START_CAPTURE,
    })
  }
}

export const stopCapture = () => {
  return async (dispatch: AppDispatch) => {
    dispatch({
      type: STOP_CAPTURE,
    })
  }
}
