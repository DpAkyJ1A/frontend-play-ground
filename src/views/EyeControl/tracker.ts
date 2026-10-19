import {
  FaceLandmarker,
  type Classifications,
} from '@mediapipe/tasks-vision';
import { withBasePath } from '@/lib/site';
import { extractFeatures } from './features';
import type { GazeSample } from './gazeEngine';
import { readFace } from './gestures';

// Copied from the installed package into public/ by scripts/copy-mediapipe-wasm.mjs.
const wasmLoaderPath = withBasePath('/mediapipe/vision_wasm_internal.js');
const wasmBinaryPath = withBasePath('/mediapipe/vision_wasm_internal.wasm');

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const blendshape = (shapes: Classifications | undefined, name: string) =>
  shapes?.categories.find((category) => category.categoryName === name)
    ?.score ?? 0;

const createLandmarker = (delegate: 'CPU' | 'GPU') =>
  FaceLandmarker.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    }
  );

export async function startCameraTracker(
  video: HTMLVideoElement,
  onSample: (sample: GazeSample) => void
) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  let landmarker: FaceLandmarker;
  try {
    video.srcObject = stream;
    await video.play();
    landmarker = await createLandmarker('GPU').catch(() =>
      createLandmarker('CPU')
    );
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    throw error;
  }

  // rAF rather than requestVideoFrameCallback: the preview can be hidden, and a
  // video that isn't composited stops getting frame callbacks
  let stopped = false;
  let lastVideoTime = -1;
  let handle: number;

  const tick = () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const time = performance.now();
      const result = landmarker.detectForVideo(video, time);
      const landmarks = result.faceLandmarks[0] ?? null;
      const shapes = result.faceBlendshapes[0];
      onSample({
        time,
        face: Boolean(landmarks),
        landmarks,
        features: landmarks
          ? extractFeatures(
              landmarks,
              result.facialTransformationMatrixes[0],
              video.videoWidth,
              video.videoHeight
            )
          : null,
        blinkLeft: blendshape(shapes, 'eyeBlinkLeft'),
        blinkRight: blendshape(shapes, 'eyeBlinkRight'),
        gestures: landmarks
          ? readFace(shapes, landmarks, video.videoWidth, video.videoHeight)
          : null,
      });
    }
    handle = requestAnimationFrame(tick);
  };
  tick();

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(handle);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      landmarker.close();
    },
  };
}
