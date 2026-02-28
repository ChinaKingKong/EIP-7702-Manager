import React, { createContext, useContext, useState, useCallback } from 'react';
import en from '../i18n/en';
import zh from '../i18n/zh';

const LANGS = { en, zh };
const STORAGE_KEY = 'eip7702_lang';

const I18nContext = createContext(null);

function getDefaultLocale() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && LANGS[saved]) return saved;
    } catch { }
    // Auto-detect browser language
    const browserLang = navigator.language || navigator.userLanguage || '';
    if (browserLang.startsWith('zh')) return 'zh';
    return 'en';
}

export function I18nProvider({ children }) {
    const [locale, setLocaleState] = useState(getDefaultLocale);

    const setLocale = useCallback((lang) => {
        if (LANGS[lang]) {
            setLocaleState(lang);
            try { localStorage.setItem(STORAGE_KEY, lang); } catch { }
        }
    }, []);

    const toggleLocale = useCallback(() => {
        setLocale(locale === 'en' ? 'zh' : 'en');
    }, [locale, setLocale]);

    /**
     * Translation function.
     * Supports dot-path keys: t('auth.signAuthorization')
     * Supports interpolation: t('common.minAgo', { n: 5 }) → "5 min ago"
     */
    const t = useCallback((key, params) => {
        const keys = key.split('.');
        let value = LANGS[locale];
        for (const k of keys) {
            if (value == null) return key;
            value = value[k];
        }
        if (typeof value !== 'string') return key;
        if (params) {
            return value.replace(/\{(\w+)\}/g, (_, name) =>
                params[name] !== undefined ? params[name] : `{${name}}`
            );
        }
        return value;
    }, [locale]);

    return (
        <I18nContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
    return ctx;
}
