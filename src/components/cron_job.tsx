import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { connectIoT } from '@/store/actions/iot'
import { updateEmotion } from '@/store/actions/user'
import { RootState, AppDispatch } from '@/store/store'
import { useUploadQueue } from '@/util/minio'
import attentionStore from '@/core/stores/attention_store'
import { HALF_POINT, VPPG_TIME_LEN, IOT_TOPIC } from '@/constant'
import FPSProcessor from '@/util/FPSProcessor'
import vppg_processor from '@/core/processors/vppg_processor'
import type { ForecastData } from '@/core/processors/vppg_processor'
import frameStore from '@/core/stores/frame_store'
import { PubSub } from 'aws-amplify'
//import stressProcessor from '@/core/processors/stress_processor'

const Cronjob = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.user);
  const isCapturing = useSelector((state: RootState) => state.isCapturing);
  const webcamStatus = useSelector((state: RootState) => state.webcamStatus);
  const pushUploadQueue = useUploadQueue(user, [webcamStatus])

  const IoTIntervalIdRef = useRef<NodeJS.Timer>()
  useEffect(() => {
    let isFirstRound = true
    let isMounted = true

    const clearAll = () => {
      if (IoTIntervalIdRef.current) {
        clearInterval(IoTIntervalIdRef.current as NodeJS.Timeout)
        IoTIntervalIdRef.current = undefined
      }
    }

    if (isCapturing) {
      clearAll();
      IoTIntervalIdRef.current = setInterval(async () => {
        if (!isMounted) return;
        const endTime = new Date(new Date().getTime() - 1000 * 2)
        const endTimeTS = endTime.getTime()
        const startTimeTS = endTimeTS - VPPG_TIME_LEN * 1000 
        const FPSMetrics = FPSProcessor.getFPSData(startTimeTS, endTimeTS)
        //console.log("endTimeTS", endTimeTS)

        const fps = FPSMetrics.fps
        //console.log("fps: ", fps)

        // load vppg model based on the fps
        if (isFirstRound) {
          await vppg_processor.loadModel(fps)
          
          // UPDATED: Try Redux first, fallback to hardcoded
          let userEmail = 'test_user@lacause.com';  // Default fallback
          let companyId = 'lacause_demo';           // Default fallback
          
          try {
            // Try to get from Redux user object
            if (user?.email && typeof user.email === 'string' && user.email.trim() !== '') {
              userEmail = user.email;
              //console.log('✅ Got user email from Redux:', userEmail);
            } else {
              //console.log('⚠️  No valid email in Redux, using fallback:', userEmail);
            }
            
            // Try to get company from Redux (note the bracket notation for colon)
            if (user?.['custom:company'] && typeof user['custom:company'] === 'string' && user['custom:company'].trim() !== '') {
              companyId = user['custom:company'];
              //console.log('✅ Got company from Redux:', companyId);
            } else {
              //console.log('⚠️  No valid company in Redux, using fallback:', companyId);
            }
            
          } catch (error) {
            //console.log('❌ Error accessing Redux user data, using fallbacks:', error);
          }
          
          //console.log('Setting user info:', { userEmail, companyId, reduxUser: user });
          vppg_processor.setUserInfo(userEmail, companyId);
          
          isFirstRound = false
        }

        const [present_percentage, head_stability] = attentionStore.stat(
          startTimeTS,
          endTimeTS
        )

        //ßconsole.log("present_percentage", present_percentage, "head_stability", head_stability)

        // calculate vppg based on the frames in the store
        const dataStartTime = startTimeTS; // ms
        // Get the input buffer for logging
        const inputBuffer = frameStore.getFramesSince(dataStartTime);
        await vppg_processor.computeBatch(dataStartTime);

        const rawSignal = frameStore.rppgPltData

        // Calculate buffer-based FPS from actual VPPG signal length
        const vppg_buffer_fps = Math.round(rawSignal.length / VPPG_TIME_LEN)

        // FIXED: Set attention metrics before getting forecast data
        // vppg_processor.setAttentionMetrics(present_percentage, head_stability, 0.5);

        // Publish ForecastData to AWS IoT Core with fpsCalculated
        const forecastData = vppg_processor.getLatestForecastData(fps);
        if (forecastData) {
          // Overwrite present_time in ForecastData with present_percentage from attentionStore.stat()
          forecastData.present_time = present_percentage;
          // Set timestamp in ForecastData to endTimeTS (end of window)
          forecastData.timestamp = endTimeTS;
          // Log the window length
          console.log('[WINDOW] startTimeTS:', startTimeTS, 'endTimeTS:', endTimeTS, 'diff (ms):', endTimeTS - startTimeTS);
          // Compare present_percentage from attentionStore.stat() and present_time from ForecastData
          console.log('[COMPARE] present_percentage (attentionStore.stat):', present_percentage, '| present_time (ForecastData):', forecastData.present_time);
          console.log('ForecastData:', {
            ...forecastData,
            vppg_signal: forecastData.vppg_signal.slice(0, 5),
            vppg_signal_length: forecastData.vppg_signal.length
          });
          const topic = `${IOT_TOPIC}/${forecastData.company_id}`;
          
          // FIXED: Log the data being sent
          //console.log('Publishing ForecastData with correct format:', {
          //  user_id: forecastData.user_id,
          //  company_id: forecastData.company_id,
          //  processed_fps: forecastData.processed_fps,
          //  zombie_score: forecastData.zombie_score,
          //  head_shakes: forecastData.head_shakes,
          //  vppg_signal_length: forecastData.vppg_signal.length,
          //  vppg_first_few: forecastData.vppg_signal.slice(0, 5)
          //});
          
          publishForecastData(topic, forecastData);
        } else {
          //console.warn('No forecast data available - vPPG processing may have failed');
        }

        // Frame Processing Details Logging
        //console.log("Frame Processing Details:", {
        //  fpsCalculated: fps,
        //  vppg_buffer_fps: vppg_buffer_fps,
        //  expectedFrames: fps * 10,
        //  inputBufferFrames: inputBuffer.length,
        //  actualVppgLength: rawSignal.length,
        //  difference: (fps * 10) - rawSignal.length,
        //  percentageAccuracy: Math.round((rawSignal.length / (fps * 10)) * 100) + "%"
        //})

        //console.log("Sending fpsCalculated to AWS:", fps)

        if (fps > 10 && rawSignal.length >= fps * 6) {
          const attention_score =
            present_percentage === 0 ? 0.0: present_percentage * (1 + Math.exp(-HALF_POINT)) / (1 + Math.exp(head_stability - HALF_POINT * present_percentage))

          //console.log("attention score", attention_score, "present time: ", present_percentage, "head shake: ", head_stability)
          
          //const stress = await stressProcessor.predict(rawSignal)
          const stress = 0.5
          const stressType = quantize_stress(stress)
          const finalType = calculateFourtypes(
            stressType,
            attention_score,
            present_percentage
          )

          vppg_processor.setAttentionMetrics(present_percentage, head_stability, attention_score);

          if (isMounted) dispatch(updateEmotion(finalType))
        } else {
          //console.log(`not enough data: got ${fps} : ${rawSignal.length}`)
        }
      }, 1000 * VPPG_TIME_LEN)
      // Connect IoT on start
      dispatch(connectIoT());
    } else {
      clearAll();
    }

    return () => {
      isMounted = false;
      clearAll();
      // Optionally, clear/trim large buffers here if needed
      // Example: frameStore.clear(); vppg_processor.reset();
    }
  }, [dispatch, isCapturing, pushUploadQueue, user, webcamStatus])

  return <></>
}

const quantize_stress = (stress: number) => {
  if (stress < 0.4) {
    return 1
  } else if (stress <= 0.8) {
    return 2
  } else if (stress <= 1) {
    return 3
  }
  return 999
}

const calculateFourtypes = (
  stressType: number,
  attention: number,
  present_percentage: number
) => {
  let attentionType
  if (present_percentage < 0.6) {
    attentionType = 999
  } else if (attention >= 0.6) {
    attentionType = 1
  } else {
    attentionType = 0
  }

  if (attentionType == 999 || stressType == 999) {
    return 999
  }

  if (attentionType == 1 && (stressType == 1 || stressType == 2)) {
    return 1
  }

  if (attentionType == 1 && stressType == 3) {
    return 2
  }

  if (attentionType == 0 && (stressType == 1 || stressType == 2)) {
    return 3
  }

  if (attentionType == 0 && stressType == 3) {
    return 4
  }

  return 999
}

// Add a robust publish function with retry logic
const publishForecastData = async (topic: string, data: ForecastData, retries = 3) => {
  try {
    // Ensure the data is properly serialized
    const serializedData = {
      ...data,
      vppg_signal: data.vppg_signal,
      timestamp: new Date().getTime(),
    };

    await PubSub.publish(topic, serializedData);
    console.log('✅ Published ForecastData to IoT successfully:', {
      topic,
      user_id: data.user_id,
      company_id: data.company_id,
      processed_fps: data.processed_fps,
      zombie_score: data.zombie_score,
      head_shakes: data.head_shakes,
      vppg_length: data.vppg_signal.length
    });
  } catch (err: unknown) {
    //console.error('❌ Failed to publish ForecastData to IoT:', err);
    if (
      retries > 0 &&
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message?: string }).message === 'string' &&
      (err as { message: string }).message.includes('AMQJS0011E Invalid state not connected')
    ) {
      //console.log(`⏳ Retrying publish in 1s (${retries} retries left)...`);
      setTimeout(() => publishForecastData(topic, data, retries - 1), 1000);
    } else {
      // Log the exact data that failed to publish for debugging
      //console.error('Failed data structure:', {
      //  topic,
      //  dataKeys: Object.keys(data),
      //  dataTypes: Object.entries(data).map(([key, value]) => `${key}: ${typeof value}`),
      //  error: err
      //});
    }
  }
};

export default Cronjob