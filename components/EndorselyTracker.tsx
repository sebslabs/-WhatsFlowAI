"use client";

import { useEffect } from "react";
import Script from "next/script";

export function EndorselyTracker() {
  useEffect(() => {
    // Utility to read and save the referral ID from the window object
    const captureReferral = () => {
      if (typeof window === "undefined") return false;

      const endorselyWindow = window as any;
      if (endorselyWindow.endorsely_referral) {
        const referralId = endorselyWindow.endorsely_referral;
        localStorage.setItem("endorsely_referral", referralId);
        console.log("⚓ [Endorsely Tracker] Successfully captured and saved referral ID:", referralId);
        return true;
      }
      return false;
    };

    // 1. Check immediately
    if (captureReferral()) return;

    // 2. Set up interval to poll for window.endorsely_referral as the script executes asynchronously
    const intervalId = setInterval(() => {
      if (captureReferral()) {
        clearInterval(intervalId);
      }
    }, 500);

    // 3. Clear polling after 15 seconds to conserve browser resources
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
    }, 15000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <Script
      async
      src="https://assets.endorsely.com/endorsely.js"
      data-endorsely="2476bf4b-2e5b-44b4-81e0-c169636d66f8"
      strategy="afterInteractive"
    />
  );
}
