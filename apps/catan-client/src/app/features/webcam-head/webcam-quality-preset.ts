import { WEBCAM_MEDIA_SCOPE, WebcamMediaScopeKey, WebcamQuality } from '@catan/api-interfaces';

export interface WebcamCapturePreset {
  readonly width: number;
  readonly height: number;
  readonly frameRate: number;
}

export function webcamQualityPreset(quality: WebcamQuality): WebcamCapturePreset {
  if (quality === WebcamQuality.Medium) {
    return {
      width: WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.MediumWidth],
      height: WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.MediumHeight],
      frameRate: WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.TargetFps],
    };
  }
  return {
    width: WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.LowWidth],
    height: WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.LowHeight],
    frameRate: WEBCAM_MEDIA_SCOPE[WebcamMediaScopeKey.TargetFps],
  };
}

export function parseWebcamQuality(value: string | null): WebcamQuality {
  if (value === WebcamQuality.Medium) {
    return WebcamQuality.Medium;
  }
  return WebcamQuality.Low;
}
