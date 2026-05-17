export function isLikelyMobileWebcamHost(): boolean {
  if (typeof globalThis.navigator === 'undefined') {
    return false;
  }
  const nav = globalThis.navigator;
  const withUaData = nav as Navigator & { userAgentData?: { mobile?: boolean } };
  if (withUaData.userAgentData?.mobile === true) {
    return true;
  }
  if (typeof nav.userAgent !== 'string') {
    return false;
  }
  const ua = nav.userAgent;
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  if (/\biPad\b/i.test(ua)) {
    return true;
  }
  if (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1) {
    return true;
  }
  return false;
}
