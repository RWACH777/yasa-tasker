export const isLocal = () => {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost";
};