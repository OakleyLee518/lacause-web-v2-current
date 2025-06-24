# gis-lacause-web-v2

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Code Structure
```
src
├── app
│   ├── layout.tsx  // top layout of main page
│   ├── page.tsx    // layout of main page
│   └── store_provider.tsx  // store provider of redux
├── components
│   ├── camera.tsx   // capture frames from camera and distribute to processors
│   ├── cron_job.tsx  // run every 10s to evaluate vppg, stress, activation, and send data to aws 
│   ├── emotion_icon.tsx  // emotion icon component
│   └── start_stop_btn.tsx  // start_stop_btn component
├── constant
│   └── index.ts  // define constants in the project
├── core
│   ├── feature_extraction  // feature extraction functions for vppg
│   │   ├── complexity_tolerance.ts
│   │   ├── entropy.ts
│   │   ├── hrv.ts
│   │   ├── hrv_utils.ts
│   │   ├── intervals_utils.ts
│   │   ├── signal_power.ts
│   │   ├── signal_psd.ts
│   │   └── utils_complexity_embedding.ts
│   ├── processors             // processors for each job
│   │   ├── face_detector_processor.ts  // face detector, use onnx model to detect face box from a frame
│   │   ├── face_tracker_processor.ts  // face tracker, track once using face detector and followed by 9 times of tracker (mosse)
│   │   ├── pose_predictor_processor.ts // detect face mesh using mediapipe, and estimete yaws from face mesh
│   │   ├── stress_processor.ts  // extract features from vppg, and calculate stress from vppg features
│   │   └── vppg_processor.ts  // evaluate vppg from frames which are being cropped to a face size, using onnx model
│   └── stores    //  store and share data 
│       ├── attention_store.ts   // store yaw data when each frame being processed, and estimate present_percentage and head_stability every 10s in cron_job
│       └── frame_store.ts  // store cropped frames and store vppg
├── store  // components for redux
│   ├── actions
│   │   ├── camera.ts
│   │   ├── iot.ts
│   │   ├── model.ts
│   │   └── user.ts
│   ├── reducer.ts
│   └── store.ts
└── util  // util functions
    ├── DSP.ts
    ├── FPSProcessor.ts
    ├── array.ts
    ├── find_peaks.js
    ├── interpolation.js
    ├── mat.ts
    ├── minio.ts
    ├── test_interpolation.html
    └── util.ts
```