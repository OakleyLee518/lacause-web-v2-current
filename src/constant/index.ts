export const MAX_TRACKING_FRAME = 10

export const MAX_FPS = 35
export const BUFFER_SIZE = 208
export const CAPTURE_FREQUENCY = 30
export const WEBCAM_WIDTH = 600  //630
export const WEBCAM_HEIGHT = 430 //430

//aws credentials
export const identityPoolId =
  'ap-northeast-1:b94e1c1f-8c67-4500-8644-2c8c635d43ad'
export const AWS_REGION = 'ap-northeast-1'
export const userPoolId = 'ap-northeast-1_h6Wcjb8F7'
export const userPoolWebClientId = '53hf72b9dltc4f4bc8rpngbt2f'
export const MQTT_ENDPOINT =
  'wss://a2om7uz4m115jp-ats.iot.ap-northeast-1.amazonaws.com/mqtt'
export const IOT_ENDPOINT = 'https://iot.ap-northeast-1.amazonaws.com'
export const IOT_POLICY_NAME = 'dev_lacause_emotion_prediction_results_v2'
export const IOT_TOPIC = 'dev_lacause_emotion_prediction_results_v2'

export const FOUR_TYPES_API =
  'https://rv041tmaa4.execute-api.ap-northeast-1.amazonaws.com/prd/app/GetTimeStreamData'

export const BLINKING_THRESHOLDED = 0.21
export const YAWNING_THRESHOLDED = 0.79
export const HEADPOSE_THRESHOLDED = 60

export const MINIO_ENDPOINT = 'https://10.31.36.211:9000'
export const BACKUP_BUCKET = 'dev-lacause-rawsignal-data'
export const COLLECT_PULSE = false
export const COLLECT_VIDEO = false

export const FACE_DETECTOR_MODEL_URI = '/models/face_detector/dev_olive_face-detector_v1.0.0.onnx'
export const VPPG_MODEL_URI = '/models/vppg/dev_olive_vppg_v2.0.0.onnx'
export const VPPG_16FPS_MODEL_URI = '/models/vppg/dev_olive_vppg-16fps_v3.0.0.onnx'
export const VPPG_24FPS_MODEL_URI = '/models/vppg/dev_olive_vppg-24fps_v3.0.0.onnx'
export const VPPG_30FPS_MODEL_URI = '/models/vppg/dev_olive_vppg-30fps_v3.0.0.onnx'

export const FACE_CONFIDENCE = 0.5
export const FACE_DETECTION_DIM = 320

export const VPPG_FRAME_DIM = 36

export const VPPG_TIME_LEN = 10
export const HALF_POINT = 5

export const MAX_FRAME_IN_BUFFER = VPPG_TIME_LEN * 30 // 400

export const VPPG_FINAL_SAMPLING_RATE = 128

export const ACTIVATION_MODEL_URI = '/models/stress/cp-09_loss-0.6800_valloss-0.6840.onnx'