import { useCallback, useEffect, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { connect, ConnectedProps } from 'react-redux'
import { useWakeLock } from 'react-screen-wake-lock'
import { COLLECT_VIDEO, MAX_FPS, VPPG_FRAME_DIM, WEBCAM_HEIGHT, WEBCAM_WIDTH } from '@/constant'
import { AppDispatch, RootState } from '@/store/store'
import { changeWebcamStatus, startCapture, stopCapture } from '@/store/actions/camera'
import faceTacker from "@/core/processors/face_tracker_processor"
import poseEstimator from '@/core/processors/pose_predictor_processor'
import { cropImageData, drawFace, drawFaceBox, maxCenterSquareBox, vppgFramePrepare } from '@/util/util'
import frameStore from '@/core/stores/frame_store'
import FPSProcessor from '@/util/FPSProcessor'
import EmotionIcon from './emotion_icon'
import attentionStore from '@/core/stores/attention_store'
//import Image from 'next/image'

type OwnProps = object
type PropsFromRedux = ConnectedProps<typeof connector>
type Props = PropsFromRedux & OwnProps

const ppgProcess = (frameAsImageData: ImageData, faceBox: number[], captureTime: number) => {
  const defaultCropBox = maxCenterSquareBox([frameAsImageData.height, frameAsImageData.width]) 
  // Determine the crop box based on whether a face is detected or not
  const cropBox = (faceBox.length == 0) ? defaultCropBox : faceBox.slice(1)
  const [left, top, right, bottom] = cropBox
  const croppedFrame = cropImageData(frameAsImageData, left, top, right, bottom)
  const resizedFrame = vppgFramePrepare(croppedFrame, VPPG_FRAME_DIM, true)

  // add in camera and use in cronjob
  frameStore.addFrame(resizedFrame, captureTime)
}

const colorFromLastEmotion = (emotion: number) => {
  switch (emotion) {
    case 3:
      return 'rgb(59 130 246)'
    case 4:
      return 'rgb(239 68 68)'
    case 2:
      return 'rgb(234 179 8)'
    case 1:
      return 'rgb(74 222 128)'
    default:
      return 'rgb(107 114 128)'
  }
}

const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    changeWebcamStatus: (isWorking: boolean) =>
      dispatch(changeWebcamStatus(isWorking)),
    startCapture: () => dispatch(startCapture()),
    stopCapture: () => dispatch(stopCapture()),
  }
}

const mapStateToProps = (state: RootState) => ({
  isCapturing: state.isCapturing,
  latestEmotion: state.latestEmotion,
})

const connector = connect(mapStateToProps, mapDispatchToProps)

const Camera = ({
  changeWebcamStatus,
  startCapture,
  stopCapture,
  isCapturing,
  latestEmotion,
}: Props) => {
  const webcamRef = useRef<Webcam>(null)
  const videoCanvasRef = useRef<HTMLCanvasElement>(null)
  const videoFaceBoxCanvasRef = useRef<HTMLCanvasElement>(null)
  const faceBoxCanvasRef = useRef<HTMLCanvasElement>(null)
  const faceCanvasRef = useRef<HTMLCanvasElement>(null)
  const [webcamRunning, setWebcamStatus] = useState(false)
  const [showCamera, toggleCamera] = useState(false)
  const reqidRef = useRef<number>(0)
  const [deviceId, setDeviceId] = useState<string>()
  const [devices, setDevices] = useState<ReadonlyArray<MediaDeviceInfo>>([])
  const { request } = useWakeLock()
  const lastFrameTime = useRef(0)
  const lastFrameTimestamp = useRef(Date.now())
  const currentDeviceId = useRef('')

  // For media recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Safari detection
  const isSafari = typeof window !== 'undefined' &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Store reference to PiP window and box for border color updates
  const pipWindowRef = useRef<Window | null>(null);
  const pipBoxRef = useRef<HTMLDivElement | null>(null);

  // iOS detection
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // State to toggle face landmarks video
  const [showLandmarks, setShowLandmarks] = useState(false);

  // State to track landmarks error
  const [landmarksError, setLandmarksError] = useState<string | null>(null);

  // iOS-specific camera switching state
  const [iosCameraFacing, setIosCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraSwitchError, setCameraSwitchError] = useState<string | null>(null);

  // Banner for camera switch errors
  const [showCameraSwitchBanner, setShowCameraSwitchBanner] = useState(true);

  // Helper to get the color for the PiP border
  const getPiPBorderColor = () => colorFromLastEmotion(latestEmotion);

  const handleFrame = useCallback(async (currentTime: number) => {
    try {
      const now = Date.now();
      console.log('[DEBUG] Time since last frame:', now - lastFrameTimestamp.current, 'ms');
      lastFrameTimestamp.current = now;
      const frameInterval = 1000 / MAX_FPS
      const timeSinceLastFrame = currentTime - lastFrameTime.current

      if (timeSinceLastFrame >= frameInterval) {
        const webcamCanvas = webcamRef.current?.getCanvas()
        const videoCanvas = videoCanvasRef.current
        if (webcamCanvas && videoCanvas) {
          const ctx = videoCanvas.getContext("2d", { willReadFrequently: true })
          ctx?.drawImage(webcamCanvas, 0, 0, WEBCAM_WIDTH, WEBCAM_HEIGHT)
          const frameAsImageData = ctx?.getImageData(0, 0, WEBCAM_WIDTH, WEBCAM_HEIGHT)
          const captureTime = Date.now();

          if (!frameAsImageData) return;

          try {
            await faceTacker.trackOneFrame(frameAsImageData, webcamCanvas)
            const isValid = faceTacker.isValid
            if (isValid) {
              const [, left, top, right, bottom] = faceTacker.stabelFaceBox
              const faceLandmarkerResult = await poseEstimator.estimate(frameAsImageData, [left, top, right, bottom])
              // draw for debug
              const faceBoxCanvas = videoFaceBoxCanvasRef.current!
              const faceCanvas = faceCanvasRef.current!
              drawFaceBox(faceBoxCanvas, [left, top, right, bottom])
              drawFace(faceCanvas, frameAsImageData, [left, top, right, bottom], faceLandmarkerResult)
              try {
                await ppgProcess(frameAsImageData, faceTacker.stabelFaceBox, captureTime)
              } catch (error) {
                console.log(error)
              }
            } else {
              // Add AttentionData with face: 0 for this frame
              attentionStore.add({
                time: Date.now(),
                yaw: attentionStore.getNewestYaw(),
                face: 0
              });
            }
            // Log FPS for every frame, regardless of face
            FPSProcessor.logCaptureSuccess();
          } catch (err: unknown) {
            if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
              const message = (err as { message: string }).message;
              if (message.includes('not loaded') || message.includes('Out of memory')) {
                setLandmarksError('ランドマークモデルの読み込みに失敗しました。\nSafariのキャッシュをクリアし、他のタブを閉じてから再度お試しください。');
              }
            }
            return;
          }
        }
        lastFrameTime.current = currentTime
      }
    } finally {
      reqidRef.current = requestAnimationFrame((ts) => handleFrame(ts));
    }
  }, [])

  useEffect(() => {
    if (webcamRunning && isCapturing) {
      changeWebcamStatus(true)
    } else {
      changeWebcamStatus(false)
    }
  }, [changeWebcamStatus, isCapturing, webcamRunning])

  useEffect(() => {
    let intervalId: number | undefined;
    if (webcamRunning && isCapturing) {
      if (isSafari) {
        intervalId = window.setInterval(() => handleFrame(performance.now()), 1000 / MAX_FPS);
      } else {
        reqidRef.current = requestAnimationFrame(handleFrame);
      }
      return () => {
        if (isSafari && intervalId !== undefined) window.clearInterval(intervalId);
        else cancelAnimationFrame(reqidRef.current);
      };
    }
  }, [webcamRunning, isCapturing, handleFrame, isSafari]);

  const enumCameras = useCallback(async () => {
    const mds = (await navigator.mediaDevices.enumerateDevices()).filter(
      ({ kind }) => kind === 'videoinput'
    )
    setDevices(mds)
    if (mds.length > 0) {
      setDeviceId(mds[0].deviceId)
    }
  }, [])
  // initial enumerate
  useEffect(() => {
    enumCameras()
  }, [enumCameras])

  const startRecorder = useCallback(() => {
    if (webcamRef.current?.stream != null && COLLECT_VIDEO) {
      mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, {
        mimeType: 'video/webm',
      })
      mediaRecorderRef.current.addEventListener(
        'dataavailable',
        async ({ data }: BlobEvent) => {
          if (!data.size) return
          // const transaction = Sentry.startTransaction({
          //   name: SENTRY_TRANSACTION_PUSH_VIDEO,
          // })
          // pushUploadQueue(data, '.webm', new Date(), () => transaction.finish())
        }
      )
      mediaRecorderRef.current.start()

      // split 10 minutes
      const intervalTime = 1000 * 60 * 10
      let targetTime = Date.now() + intervalTime
      const intervalId = setInterval(() => {
        if (mediaRecorderRef.current?.state !== 'recording') {
          clearInterval(intervalId)
          mediaRecorderRef.current = null
          return
        }
        if (Date.now() < targetTime) return

        // MediaRecorder.requestData only contains pure intermediate data without file header in the blob, so incomplete data is sent
        // Therefore, blob data including header is saved by "stop & start"
        const restart = () => {
          console.log('restart')
          mediaRecorderRef.current?.start()
          mediaRecorderRef.current?.removeEventListener('stop', restart)
        }
        mediaRecorderRef.current.addEventListener('stop', restart)
        mediaRecorderRef.current.stop()

        // Set next interval
        targetTime = Date.now() + intervalTime
      }, 1000)
    }
  }, [])//[pushUploadQueue])

  // Camera switch handler for iOS and others
  const handleCameraSwitch = async (idOrFacing: string) => {
    if (isIOS) {
      setIosCameraFacing(idOrFacing as 'user' | 'environment');
      setCameraSwitchError(null);
      // Stop previous tracks before switching
      const video = webcamRef.current?.video;
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: idOrFacing } });
        if (video) {
          video.srcObject = stream;
          video.load();
          video.play().catch(() => {});
          // Detect if video gets stuck (no frames)
          const frameCheckTimeout = setTimeout(() => {
            if (video.readyState < 2 || video.paused || video.ended) {
              setCameraSwitchError('バックカメラの映像が取得できません。iOS/Safariの制限により一部端末で利用できない場合があります。\n他のアプリやタブを閉じて再度お試しください。');
            }
          }, 3000);
          video.onplaying = () => clearTimeout(frameCheckTimeout);
        }
        // Check if the actual camera switched
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        if (idOrFacing === 'environment' && settings.facingMode !== 'environment') {
          setCameraSwitchError('お使いのiPhoneではバックカメラが利用できません。iOS/Safariの制限です。');
        }
      } catch {
        setCameraSwitchError('カメラの切り替えに失敗しました。Safariの設定や権限をご確認ください。');
      }
    } else {
      setDeviceId(idOrFacing);
      currentDeviceId.current = idOrFacing;
    }
  };

  // Enhanced capture click: auto PiP if supported, with iOS support and better debugging
  const handleCaptureClick = async () => {
    setCameraError(null);
    // iOS: call getUserMedia directly on user gesture, with facingMode
    if (isIOS) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        console.log('iOS getUserMedia success:', stream);
        // Attach stream to video element before enumerating devices (iOS Safari quirk)
        if (webcamRef.current && webcamRef.current.video) {
          webcamRef.current.video.srcObject = stream;
        }
      } catch (err: unknown) {
        console.error('iOS getUserMedia error:', err);
        let msg = 'カメラにアクセスできません。iPhoneの「設定 > Safari > カメラ」または「設定 > プライバシー > カメラ > Safari」でカメラのアクセスを許可してください。\nまたは、ページを再読み込みしてカメラの許可を再度行ってください。';
        if (typeof err === 'object' && err && 'message' in err) {
          msg += '\nエラー: ' + (err as { message?: string }).message;
        } else {
          msg += '\nエラー: ' + String(err);
        }
        setCameraError(msg);
        return;
      }
      // After permission, enumerate devices
      await enumCameras();
      // Log devices for debugging
      navigator.mediaDevices.enumerateDevices().then(devs => {
        console.log('iOS enumerateDevices:', devs);
        if (!devs || devs.filter(d => d.kind === 'videoinput').length === 0) {
          setCameraError(
            'カメラデバイスが見つかりません。\niPhoneの「設定 > Safari > カメラ」または「設定 > プライバシー > カメラ > Safari」でカメラのアクセスを許可してください。\nまたは、ページを再読み込みしてカメラの許可を再度行ってください。\n(デバイスリストが空です)'
          );
        }
      });
    }
    if ('documentPictureInPicture' in window) {
      try {
        // @ts-expect-error - experimental API
        const pipWindow = await window.documentPictureInPicture.requestWindow();
        pipWindowRef.current = pipWindow;
        // Create a container div for the PiP box
        const pipBox = pipWindow.document.createElement('div') as HTMLDivElement;
        pipBox.style.width = '100vw';
        pipBox.style.height = '100vh';
        pipBox.style.display = 'flex';
        pipBox.style.alignItems = 'center';
        pipBox.style.justifyContent = 'center';
        pipBox.style.background = '#111';
        pipBox.style.border = `8px solid ${getPiPBorderColor()}`;
        pipBox.style.borderRadius = '24px';
        pipBox.style.boxSizing = 'border-box';
        pipBox.style.overflow = 'hidden';
        // Add the video element
        const video = webcamRef.current?.video;
        if (video) {
          // Clone the video node for PiP (safer than moving it)
          const pipVideo = video.cloneNode(true) as HTMLVideoElement;
          pipVideo.style.width = '100%';
          pipVideo.style.height = '100%';
          pipVideo.style.objectFit = 'cover';
          pipBox.appendChild(pipVideo);
        }
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.appendChild(pipBox);
        pipBoxRef.current = pipBox;
        // Listen for PiP window close to clean up
        pipWindow.addEventListener('pagehide', async () => {
          pipWindowRef.current = null;
          pipBoxRef.current = null;
          // Restore: Only call stopCapture (from props) to stop measurement and show start button
          if (typeof stopCapture === 'function') {
            await stopCapture();
          }
        });
      } catch (err) {
        setCameraError('PiPモードにできません: ' + err);
        // fallback to normal capture
        await request();
        await startCapture();
        startRecorder();
        return;
      }
      // Start capture after PiP is set up
      await request();
      await startCapture();
      startRecorder();
      return;
    }
    // fallback: normal capture
    await request();
    await startCapture();
    startRecorder();
  };

  // Update PiP border color when latestEmotion changes
  useEffect(() => {
    if (pipBoxRef.current) {
      pipBoxRef.current.style.border = `8px solid ${colorFromLastEmotion(latestEmotion)}`;
    }
  }, [latestEmotion]);

  // If the camera is no longer accessible, continue enumerating until it is accessible.
  const enumCamerasIntervalId = useRef<NodeJS.Timer>()
  useEffect(() => {
    if (webcamRunning) {
      if (enumCamerasIntervalId.current) {
        clearInterval(enumCamerasIntervalId.current as NodeJS.Timeout)
        enumCamerasIntervalId.current = undefined
      }
      return
    }

    if (enumCamerasIntervalId.current) {
      return
    }

    enumCamerasIntervalId.current = setInterval(() => enumCameras(), 1000 * 5) // 5s

    return () => {
      if (enumCamerasIntervalId.current) {
        clearInterval(enumCamerasIntervalId.current as NodeJS.Timeout)
      }
    }
  }, [enumCameras, webcamRunning])

  // Force redraw of faceCanvas when showLandmarks is toggled ON (iOS Safari fix)
  useEffect(() => {
    if (showLandmarks && faceCanvasRef.current) {
      const ctx = faceCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, faceCanvasRef.current.width, faceCanvasRef.current.height);
        ctx.globalAlpha = 0.01;
        ctx.fillRect(0, 0, 1, 1);
        ctx.globalAlpha = 1.0;
      }
    }
  }, [showLandmarks]);

  // When cameraSwitchError is cleared, also hide the banner
  useEffect(() => {
    if (!cameraSwitchError) {
      setShowCameraSwitchBanner(false);
    }
  }, [cameraSwitchError]);

  return (
    <>
      {/* Main UI */}
      <div
        className={`h-[calc(100vh-70px)] z-40 top-[40px] right-0 w-full bg-contain bg-top bg-no-repeat bg-center`}
      >
        {/* Responsive, mobile-friendly control bar */}
        <div
          className="camera-controls"
          style={{
            position: 'fixed',
            top: 60,
            right: 0,
            zIndex: 2147483647,
            pointerEvents: 'auto',
            width: '100vw',
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: 12,
            background: 'rgba(31,41,55,0.95)', // bg-gray-800
            padding: 8,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
            <EmotionIcon />
          </div>
          <button
            onClick={() => toggleCamera((prv) => !prv)}
            style={{
              minWidth: 44,
              minHeight: 44,
              fontSize: 16,
              padding: '8px 16px',
              color: 'white',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              marginRight: 4,
              marginBottom: 0,
              flexShrink: 0,
            }}
          >
            📷: {showCamera ? 'On' : 'Off'}
          </button>
          <button
            onClick={() => setShowLandmarks((prv) => !prv)}
            style={{
              minWidth: 44,
              minHeight: 44,
              fontSize: 16,
              padding: '8px 16px',
              color: 'white',
              background: showLandmarks ? '#3b82f6' : '#6b7280',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              marginRight: 4,
              marginBottom: 0,
              flexShrink: 0,
            }}
          >
            🧑‍🦲: {showLandmarks ? 'On' : 'Off'}
          </button>
          {isIOS ? (
            <>
              <button
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  fontSize: 16,
                  padding: '8px 16px',
                  color: 'white',
                  background: iosCameraFacing === 'user' ? '#3b82f6' : '#6b7280',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginRight: 4,
                  marginBottom: 0,
                  flexShrink: 0,
                }}
                onClick={() => handleCameraSwitch('user')}
              >
                Front Camera
              </button>
              <button
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  fontSize: 16,
                  padding: '8px 16px',
                  color: 'white',
                  background: iosCameraFacing === 'environment' ? '#3b82f6' : '#6b7280',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginRight: 4,
                  marginBottom: 0,
                  flexShrink: 0,
                }}
                onClick={() => handleCameraSwitch('environment')}
              >
                Back Camera
              </button>
            </>
          ) : (
            devices.map((device, i) => (
              <button
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  fontSize: 16,
                  padding: '8px 16px',
                  color: 'white',
                  background: deviceId === device.deviceId ? '#3b82f6' : '#6b7280',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginRight: 4,
                  marginBottom: 0,
                  flexShrink: 0,
                }}
                key={device.deviceId}
                onClick={() => handleCameraSwitch(device.deviceId)}
              >
                {device.label || `Device ${i + 1}`}
              </button>
            ))
          )}
        </div>
        {!isCapturing && (
          <div
            className="text-center"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 2147483647,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <button
              className="font-black p-1 text-9xl text-white rounded cursor-pointer bg-blue-500 hover:bg-blue-900"
              onClick={handleCaptureClick}
              style={{
                width: WEBCAM_WIDTH,
                height: WEBCAM_HEIGHT,
                touchAction: 'manipulation',
              }}
            >
              けいそくを
              <br />
              はじめる
            </button>
          </div>
        )}
        {/* Arrange camera frame and face landmarks side by side */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 16,
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            maxWidth: '100vw',
            margin: '100px auto 0 auto',
            position: 'relative',
            zIndex: 10,
            flexWrap: 'wrap',
          }}
        >
          {/* Main camera/video/canvas */}
          <div style={{ minWidth: WEBCAM_WIDTH, maxWidth: WEBCAM_WIDTH }}>
            <div
              style={{
                position: 'relative',
                width: WEBCAM_WIDTH,
                height: WEBCAM_HEIGHT,
                background: '#111',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
              }}
            >
              <Webcam
                className="ml-auto z-50"
                audio={false}
                width={WEBCAM_WIDTH}
                height={WEBCAM_HEIGHT}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: WEBCAM_WIDTH,
                  height: WEBCAM_HEIGHT,
                  deviceId,
                  frameRate: {
                    ideal: MAX_FPS,
                    max: MAX_FPS,
                  },
                }}
                onUserMedia={() => {
                  setWebcamStatus(true)
                  // ... existing code ...
                }}
                onUserMediaError={() => setWebcamStatus(false)}
                playsInline
                autoPlay
              />
              <canvas ref={videoCanvasRef} width={WEBCAM_WIDTH} height={WEBCAM_HEIGHT} style={{ width: '100%', height: 'auto', display: 'block' }} />
              {cameraSwitchError && showCameraSwitchBanner && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: '#ef4444', // red-500
                    zIndex: 200,
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 18,
                    fontWeight: 'bold',
                    padding: '16px 48px 16px 16px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ flex: 1 }}>{cameraSwitchError}</span>
                  <button
                    onClick={() => setShowCameraSwitchBanner(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      fontSize: 24,
                      fontWeight: 'bold',
                      marginLeft: 16,
                      cursor: 'pointer',
                    }}
                    aria-label="閉じる"
                  >
                    ×
                  </button>
                </div>
              )}
              {!showCamera && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(34,34,34,0.99)',
                    zIndex: 100,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 18,
                    borderRadius: 12,
                  }}
                >
                  カメラは非表示です
                </div>
              )}
              {cameraError && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.8)',
                    zIndex: 300,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 16,
                    borderRadius: 12,
                    textAlign: 'center',
                    padding: 16,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {cameraError}
                </div>
              )}
            </div>
          </div>
          <div style={{ minWidth: WEBCAM_WIDTH * 0.4, maxWidth: WEBCAM_WIDTH * 0.4, width: WEBCAM_WIDTH * 0.4, height: WEBCAM_HEIGHT * 0.6, maxHeight: WEBCAM_HEIGHT * 0.6, position: 'relative' }}>
            {landmarksError ? (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'rgba(34,34,34,0.99)',
                  zIndex: 100,
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 16,
                  borderRadius: 12,
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                  padding: 16,
                }}
              >
                {landmarksError}
              </div>
            ) : (
              <>
                <canvas
                  id="faceCanvas"
                  ref={faceCanvasRef}
                  width={WEBCAM_WIDTH * 0.4}
                  height={WEBCAM_HEIGHT * 0.6}
                  style={{
                    backgroundColor: 'transparent',
                    pointerEvents: 'none',
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    borderRadius: 12,
                    boxShadow: '0 2px 16px rgba(0,0,0,0.1)',
                    maxWidth: WEBCAM_WIDTH * 0.4,
                    maxHeight: WEBCAM_HEIGHT * 0.6,
                    aspectRatio: `${WEBCAM_WIDTH * 0.4} / ${WEBCAM_HEIGHT * 0.6}`,
                  }}
                />
                {!showLandmarks && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'rgba(34,34,34,0.99)',
                      zIndex: 100,
                      pointerEvents: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 16,
                      borderRadius: 12,
                    }}
                  >
                    ランドマークは非表示です
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {/* Keep other canvases hidden or absolutely positioned if needed for debug, but not overlapping main UI */}
        <div style={{ display: 'none' }}>
          <canvas
            id="faceBoxCanvas"
            ref={faceBoxCanvasRef}
            width={WEBCAM_WIDTH}
            height={WEBCAM_HEIGHT}
          />
          <canvas
            id="videoFaceBoxCanvas"
            ref={videoFaceBoxCanvasRef}
            width={WEBCAM_WIDTH}
            height={WEBCAM_HEIGHT}
          />
        </div>
        {/* Mobile-specific style tweaks */}
        <style>{`
          @media (max-width: 700px) {
            .camera-controls {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 8px !important;
              border-radius: 0 !important;
              top: 0 !important;
              padding: 12px 4px !important;
            }
            .camera-controls button {
              font-size: 18px !important;
              min-width: 100% !important;
              margin-right: 0 !important;
              margin-bottom: 8px !important;
              border-radius: 8px !important;
            }
            /* Stack camera and face canvas vertically on mobile */
            .camera-main-flex {
              flex-direction: column !important;
              gap: 8px !important;
            }
            /* Face landmarks canvas should be 100% width but maintain portrait aspect ratio */
            #faceCanvas {
              width: 100% !important;
              height: auto !important;
              aspect-ratio: 2/3 !important;
              max-width: ${WEBCAM_WIDTH * 0.4}px !important;
              max-height: ${WEBCAM_HEIGHT * 0.6}px !important;
            }
          }
        `}</style>
      </div>
    </>
  )
}

export default connector(Camera)