/** localStorage key for the visitor's theme choice. Absent means "follow the device". */
export const THEME_STORAGE_KEY = "echome-theme";

export type Theme = "light" | "dark";

/**
 * Runs synchronously in <head>, before first paint, so a saved choice never
 * flashes the wrong theme. Kept as a string because it is inlined into the page.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
