// import { logout as Logout, loginWithEmailPassword } from '../libs/cognito'
import { START_STOP_BTN } from '@/store/actions/camera'
//import { AWSUserInfo } from '@/store/reducer'
import { AppDispatch } from '@/store/store'

export const USER_LOGIN_START = 'USER_LOGIN_START'
export const USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS'
export const USER_LOGIN_FAILED = 'USER_LOGIN_FAILED'
export const USER_LOGOUT = '  USER_LOGOUT'

export const EMOTION_CHANGE = 'EMOTION_CHANGE'

export const userLoginUsingEmailPassword = (
  username: string,
  password: string
) => {
  return async (dispatch: AppDispatch) => {
    console.log(username, password, dispatch)
    // try {
    //   dispatch({
    //     type: USER_LOGOUT,
    //   })
    //   await Logout()
    // } catch (error) {
    //   console.log(error)
    // }
    // dispatch({
    //   type: USER_LOGIN_START,
    // })

    // loginWithEmailPassword(username, password)
    //   .then(async (user) => {
    //     loginSuccessCallback(dispatch)
    //   })
    //   .catch((err) => {
    //     dispatch({
    //       type: USER_LOGIN_FAILED,
    //     })
    //   })
  }
}

export const logout = () => {
  return async (dispatch: AppDispatch) => {
    try {
      dispatch({
        type: START_STOP_BTN,
        data: false,
      })
      // await Logout()

      dispatch({
        type: USER_LOGOUT,
      })
    } catch (error) {
      console.log(error)
    }
  }
}

export const updateEmotion = (emotion: unknown) => {
  return (dispatch: AppDispatch) => {
    dispatch({
      type: EMOTION_CHANGE,
      data: emotion,
    })
  }
}
