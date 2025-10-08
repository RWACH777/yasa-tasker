// lib/piSDK.ts
// Dynamically load the official Pi SDK in the browser and return the Pi object.
// Safe to call multiple times (it resolves immediately if already loaded).

export async function loadPiSDK(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("loadPiSDK() can only run in a browser environment.");
  }

  // If Pi already loaded, return it
  if ((window as any).Pi) {
    return (window as any).Pi;
  }

  // Avoid adding the script twice
  const existing = document.querySelector('script[src="https://sdk.minepi.com/pi-sdk.js"]');
  if (existing) {
    // wait for onload if not ready yet
    return new Promise((resolve, reject) => {
      (existing as HTMLScriptElement).addEventListener("load", () => resolve((window as any).Pi));
      (existing as HTMLScriptElement).addEventListener("error", (e) => reject(e));
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.minepi.com/pi-sdk.js";
    s.async = true;
    s.onload = () => {
      if ((window as any).Pi) return resolve((window as any).Pi);
      return reject(new Error("Pi SDK loaded but window.Pi is not available"));
    };
    s.onerror = (err) => reject(err);
    document.head.appendChild(s);
  });
}