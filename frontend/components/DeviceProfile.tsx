"use client";

import { useEffect } from "react";

type DeviceKind = "phone-small" | "phone" | "phone-large" | "tablet" | "desktop";

function detectDevice() {
  const width = Math.round(window.visualViewport?.width || window.innerWidth);
  const height = Math.round(window.visualViewport?.height || window.innerHeight);
  const dpr = window.devicePixelRatio || 1;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const touch = navigator.maxTouchPoints > 0;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  let device: DeviceKind = "desktop";
  if (shortSide <= 374) device = "phone-small";
  else if (shortSide <= 430) device = "phone";
  else if (shortSide <= 540) device = "phone-large";
  else if (touch && width <= 1024) device = "tablet";

  let model: string = device;
  if (isIOS && device === "phone-small") model = "iphone-compact";
  if (isIOS && device === "phone") model = dpr >= 3 && longSide >= 800 ? "iphone-pro" : "iphone";
  if (isIOS && device === "phone-large") model = "iphone-plus";
  if (isAndroid && device.startsWith("phone")) model = "android-phone";
  if (isIOS && device === "tablet") model = "ipad";
  if (isAndroid && device === "tablet") model = "android-tablet";

  return {
    device,
    model,
    os: isIOS ? "ios" : isAndroid ? "android" : "desktop",
    width: String(width),
    height: String(height),
    dpr: String(Math.round(dpr * 100) / 100),
  };
}

export function DeviceProfile() {
  useEffect(() => {
    const apply = () => {
      const profile = detectDevice();
      const root = document.documentElement;
      root.dataset.device = profile.device;
      root.dataset.deviceModel = profile.model;
      root.dataset.os = profile.os;
      root.style.setProperty("--device-width", `${profile.width}px`);
      root.style.setProperty("--device-height", `${profile.height}px`);
      root.style.setProperty("--device-dpr", profile.dpr);
    };

    apply();
    window.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return null;
}
