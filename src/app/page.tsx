"use client"
export const dynamic = "force-static"
import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Auth } from "aws-amplify"
import Amplify from "aws-amplify"
import awsExports from "@/aws-exports"
import {
  loadFaceDetectModel,
  loadLandmarkModel,
  // loadVPPGModel,
  modelReady,
  ModelState
} from '@/store/actions/model'
import { logout, USER_LOGIN_SUCCESS, USER_LOGIN_FAILED } from '@/store/actions/user'
import { disconnectIoT, setupIoTProvider } from '@/store/actions/iot'
import EmotionIcon from "@/components/emotion_icon"
import StartStopBtn from "@/components/start_stop_btn"
import Cronjob from '@/components/cron_job'
import nextDynamic from 'next/dynamic';
import { AppDispatch, RootState } from '@/store/store'
import { createSelector } from 'reselect';

Amplify.configure(awsExports);

const Camera = nextDynamic(() => import('../components/camera'), { ssr: false });

// Memoized selector for Home page
const selectHomeState = createSelector(
  (state: RootState) => state,
  (state) => ({
    isLogin: state.isLogin,
    faceDetectModelStatus: state.faceDetectModelStatus,
    landmarkModelStatus: state.landmarkModelStatus,
    isCaptureReady: state.isCaptureReady,
    isCameraReady: state.isCameraReady,
    webcamStatus: state.webcamStatus,
    iotConnectionStatus: state.iotConnectionStatus,
  })
);

setupIoTProvider();

export default function Home() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    isLogin,
    faceDetectModelStatus,
    landmarkModelStatus,
    isCaptureReady,
    isCameraReady,
    webcamStatus,
    iotConnectionStatus,
  } = useSelector(selectHomeState);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  console.log("isLogin:", isLogin);

  // Model loading
  useEffect(() => {
    dispatch(loadFaceDetectModel());
    dispatch(loadLandmarkModel());
    // loadVPPGModel()
  }, [dispatch]);

  useEffect(() => {
    if (
      faceDetectModelStatus == ModelState.MODEL_LOADED &&
      landmarkModelStatus == ModelState.MODEL_LOADED
    ) {
      dispatch(modelReady());
    }
  }, [landmarkModelStatus, faceDetectModelStatus, dispatch]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const user = await Auth.signIn(email, password);
      dispatch({ type: USER_LOGIN_SUCCESS, data: user.attributes });
      setEmail("");
      setPassword("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Login failed");
      } else {
        setError("Login failed");
      }
      dispatch({ type: USER_LOGIN_FAILED });
    }
  };

  // If not logged in, show login form
  if (!isLogin) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        style={{
          background: `
            repeating-linear-gradient(135deg, #e5e7eb 0px, #e5e7eb 24px, #f3f4f6 24px, #f3f4f6 48px),
            url('data:image/svg+xml;utf8,<svg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"30\" cy=\"30\" r=\"1.5\" fill=\"%239ca3af\"/><circle cx=\"0\" cy=\"0\" r=\"1.5\" fill=\"%239ca3af\"/><circle cx=\"60\" cy=\"0\" r=\"1.5\" fill=\"%239ca3af\"/><circle cx=\"0\" cy=\"60\" r=\"1.5\" fill=\"%239ca3af\"/><circle cx=\"60\" cy=\"60\" r=\"1.5\" fill=\"%239ca3af\"/></svg>') repeat`,
          backgroundColor: '#f3f4f6',
        }}
      >
        <div
          className="relative flex flex-col items-center justify-center p-10 rounded-2xl shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.95)',
            boxShadow: '0 8px 32px 0 rgba(31, 41, 55, 0.15)',
            maxWidth: 480,
            width: '100%',
          }}
        >
          <div className="flex flex-col items-center mb-8">
            <span className="text-5xl font-extrabold text-green-800 mb-2 tracking-widest">OLIVE</span>
            <div className="flex flex-row items-center justify-center w-full mt-2">
              {/* VPPG Wave SVG */}
              <svg width="60" height="32" viewBox="0 0 60 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                <path d="M0 16 Q10 8 20 16 T40 16 T60 16" stroke="#38bdf8" strokeWidth="3" fill="none"/>
                <circle cx="10" cy="16" r="2" fill="#38bdf8"/>
                <circle cx="30" cy="16" r="2" fill="#38bdf8"/>
                <circle cx="50" cy="16" r="2" fill="#38bdf8"/>
              </svg>
              <span className="text-xl font-semibold text-blue-500 whitespace-nowrap">Dev LaCause V2 Test</span>
              {/* Face with Landmarks SVG */}
              <svg width="36" height="32" viewBox="0 0 36 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2">
                <ellipse cx="18" cy="16" rx="14" ry="14" stroke="#0ea5e9" strokeWidth="2" fill="#f0f9ff"/>
                {/* Eyes */}
                <circle cx="13" cy="14" r="1.2" fill="#0ea5e9"/>
                <circle cx="23" cy="14" r="1.2" fill="#0ea5e9"/>
                {/* Nose */}
                <circle cx="18" cy="18" r="0.8" fill="#0ea5e9"/>
                {/* Mouth */}
                <path d="M15 21 Q18 24 21 21" stroke="#0ea5e9" strokeWidth="1.2" fill="none"/>
                {/* Landmarks */}
                <circle cx="13" cy="14" r="0.3" fill="#38bdf8"/>
                <circle cx="23" cy="14" r="0.3" fill="#38bdf8"/>
                <circle cx="18" cy="18" r="0.3" fill="#38bdf8"/>
                <circle cx="16" cy="20" r="0.3" fill="#38bdf8"/>
                <circle cx="20" cy="20" r="0.3" fill="#38bdf8"/>
              </svg>
            </div>
          </div>
          <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
            <h2 className="text-2xl mb-4">Login</h2>
            <input
              type="email"
              placeholder="Email"
              className="border p-2 mb-4 w-full"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="border p-2 mb-4 w-full"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && <div className="text-red-500 mb-2">{error}</div>}
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded w-full">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If logged in, show the main app
  return (
    <div
      className={`App z-49 bg-gray-900 min-h-screen bg-cover bg-[url('https://vpgaccdemo-web.project-olive.info/img/bg.32224efa.png')]`}
    >
      <div className="md:flex p-2 items-center justify-between">
        <StartStopBtn />
        <div>Build ver.23.09.18</div>
        <div className="icon flex space-x-4">
          <EmotionIcon/>
          <div className="tooltip">
            <svg className={`h-10 w-10 ${isLogin ? 'text-green-500' : 'text-gray-300'}`}/>
          </div>
          <div className="tooltip">
            <svg className={`h-10 w-10 tooltip ${faceDetectModelStatus === ModelState.MODEL_LOADED && landmarkModelStatus === ModelState.MODEL_LOADED ? 'text-green-500' : 'text-gray-300'}`}/>
          </div>
          <div className="tooltip">
            <svg className={`h-10 w-10 tooltip ${webcamStatus ? 'text-green-500' : 'text-gray-300'}`}/>{' '}
          </div>
          <div className="tooltip">
            <svg className={`h-10 w-10 tooltip ${isCameraReady ? 'text-green-500' : 'text-gray-300'}`}/>
          </div>
          <div className="tooltip">
            <svg className={`h-10 w-10 tooltip ${iotConnectionStatus ? 'text-green-500' : 'text-gray-300'}`}/>
          </div>
          <div className="tooltip">
            {isLogin && (
              <>
                <svg
                  onClick={() => {
                    dispatch(disconnectIoT());
                    dispatch(logout());
                  }}
                  className={`h-10 w-10`}
                />
                <span className="tooltiptext">ろぐあうと</span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* <AWS /> */}
      <Camera/>
      <Cronjob />
      {isCaptureReady && isLogin ? (
        <></>
      ) : (
        (() => {
          return null
        })()
      )}
    </div>
  );
}

