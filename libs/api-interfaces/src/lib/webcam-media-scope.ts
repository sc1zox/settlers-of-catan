export enum WebcamMediaScopeKey {
  MaxLobbyPlayers = 'maxLobbyPlayers',
  HeadDisplayGamma = 'headDisplayGamma',
  TargetFps = 'targetFps',
  LowWidth = 'lowWidth',
  LowHeight = 'lowHeight',
  MediumWidth = 'mediumWidth',
  MediumHeight = 'mediumHeight',
  PerformanceFpsFloor = 'performanceFpsFloor',
  PerformanceFrameMsCeiling = 'performanceFrameMsCeiling',
}

export const WEBCAM_MEDIA_SCOPE: Readonly<Record<WebcamMediaScopeKey, number>> = {
  [WebcamMediaScopeKey.MaxLobbyPlayers]: 4,
  [WebcamMediaScopeKey.HeadDisplayGamma]: 1.55,
  [WebcamMediaScopeKey.TargetFps]: 15,
  [WebcamMediaScopeKey.LowWidth]: 320,
  [WebcamMediaScopeKey.LowHeight]: 240,
  [WebcamMediaScopeKey.MediumWidth]: 480,
  [WebcamMediaScopeKey.MediumHeight]: 360,
  [WebcamMediaScopeKey.PerformanceFpsFloor]: 45,
  [WebcamMediaScopeKey.PerformanceFrameMsCeiling]: 22,
};
