// simple i18n service using [data-i18n]
import en from '../locales/en.yml';
import zhCN from '../locales/zh-CN.yml';

export const languages = {
  en,
  'zh-CN': zhCN
};

const langKey = 'lang';

export function getDefaultLanguage() {
  const item = localStorage.getItem(langKey);
  if (item != null) return item;
  const lang = navigator.language;
  for (const key in languages) {
    if (lang.includes(key)) return key;
  }
  return 'en';
}

export const defaultLanguage = getDefaultLanguage();

export let language = defaultLanguage;

export function changeLanguage(lang) {
  if (lang in languages) {
    language = lang;
    localStorage.setItem(langKey, lang);
    refreshI18n();
  }
}

export function refreshI18n() {
  for (const el of Array.from(document.querySelectorAll('[data-i18n]'))) {
    el.textContent =
      languages[language][el.dataset.i18n] ?? el.textContent ?? el.dataset.i18n;
  }
}

refreshI18n();

{
  /** @type {HTMLSelectElement} */
  const sel = document.querySelector('#switch-language');
  if (sel) {
    sel.addEventListener('change', () => {
      changeLanguage(sel.value);
    });
  }
}
