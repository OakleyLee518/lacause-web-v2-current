import { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import { startStop } from '@/store/actions/camera'
import { ArrowPathIcon } from '@heroicons/react/24/solid'
import { AppDispatch, RootState } from '@/store/store'

const autoStart = true

function StartStopBtn(props: { isCameraReady: boolean; isLogin: boolean; isCaptureReady: boolean; user: { email: string }; startStop: (capture: boolean) => void }) {
  const [isStartable, setStartable] = useState(false)
  const [userEmail, setUserMail] = useState('')

  const { isCaptureReady, isLogin, startStop, user } = props;

  useEffect(() => {
    if (isCaptureReady && isLogin) {
      setStartable(true)
    } else {
      setStartable(false)
    }
  }, [isCaptureReady, isLogin])

  useEffect(() => {
    if (autoStart && isStartable) {
      startStop(true)
    }
  }, [isStartable, startStop])

  useEffect(() => {
    if (isLogin) {
      setUserMail(user.email)
    }
  }, [isLogin, user])

  if (!props.isLogin) return <div></div>

  if (!isStartable) {
    return (
      <>
        <ArrowPathIcon className="h-6 w-6 animate-spin" />
      </>
    )
  }

  return <>{userEmail && <div className="pl-2">{userEmail}</div>}</>
}

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    startStop: (capture: boolean) => dispatch(startStop(capture)),
  }
}

const mapStateToProps = (state: RootState) => {
  return {
    isCameraReady: state.isCameraReady,
    isLogin: state.isLogin,
    isCaptureReady: state.isCaptureReady,
    user: state.user,
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(StartStopBtn)
