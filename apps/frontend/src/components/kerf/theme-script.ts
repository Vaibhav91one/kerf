// Runs before paint so a remembered theme never flashes the other palette.
// Kept out of the client component so the root layout can inline it in <head>.
export const THEME_STORAGE_KEY = 'kerf.theme';

export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;
