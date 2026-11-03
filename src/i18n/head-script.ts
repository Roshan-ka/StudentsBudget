import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, LANGUAGES, OFFERED, type Language } from './languages';

/**
 * The inline script the root layout puts in <head>: before the first paint it sets <html lang> and dir to the
 * language `pickLanguage` would pick, so the browser, screen readers and hyphenation get the right language from the
 * start (pages are prerendered in the default one). A stored choice counts when it can be picked (`selectable`,
 * which in a dev build lists the drafts too); the phone's own languages pick only an offered one. Plain ES5, generated
 * from the registry so it never drifts from it; storage that can't be read leaves the page as rendered.
 */
export function languageHeadScript(
  offered: readonly Language[] = OFFERED,
  selectable: readonly Language[] = offered,
): string {
  const pickable = [...new Set([...offered, ...selectable])];
  const dirs = Object.fromEntries(pickable.map((code) => [code, LANGUAGES[code].dir]));
  return (
    '(function(){try{' +
    `var o=${JSON.stringify(offered)},p=${JSON.stringify(pickable)},d=${JSON.stringify(dirs)};` +
    `var s=localStorage.getItem(${JSON.stringify(LANGUAGE_STORAGE_KEY)});` +
    'var l=p.indexOf(s)>=0?s:null;' +
    'var b=navigator.languages||[navigator.language];' +
    "for(var i=0;!l&&i<b.length;i++){var m=String(b[i]).toLowerCase().split('-')[0];if(o.indexOf(m)>=0)l=m}" +
    `l=l||${JSON.stringify(DEFAULT_LANGUAGE)};` +
    'document.documentElement.lang=l;document.documentElement.dir=d[l]' +
    '}catch(e){}})()'
  );
}
