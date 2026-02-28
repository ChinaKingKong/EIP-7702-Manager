import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
];

export default function LanguageSwitcher() {
    const { locale, setLocale, t } = useI18n();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

    const handleSwitch = (lang) => {
        if (lang.code === locale) {
            setOpen(false);
            return;
        }
        setOpen(false);
        setLoading(true);

        // Delay the actual switch slightly so the animation plays
        setTimeout(() => {
            setLocale(lang.code);
        }, 600);

        // Dismiss loading after animation completes
        setTimeout(() => {
            setLoading(false);
        }, 1600);
    };

    // Prevent body scroll during loading
    useEffect(() => {
        if (loading) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [loading]);

    return (
        <>
            {/* Full-screen loading overlay — portaled to body for true centering */}
            {loading && createPortal(
                <div className="lang-loading-overlay">
                    <div className="lang-loading-content">
                        {/* Orbiting rings */}
                        <div className="lang-loading-rings">
                            <div className="lang-ring lang-ring-1" />
                            <div className="lang-ring lang-ring-2" />
                            <div className="lang-ring lang-ring-3" />
                        </div>
                        {/* Logo */}
                        <div className="lang-loading-logo">
                            <img src="/logo.png" alt="Logo" />
                        </div>
                        {/* Text */}
                        <div className="lang-loading-text">
                            <Languages size={16} />
                            <span>{t('lang.switchLang')}</span>
                        </div>
                        {/* Particles */}
                        <div className="lang-particles">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="lang-particle" style={{ '--i': i }} />
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Dropdown */}
            <div style={{ position: 'relative' }}>
                <button
                    className="btn btn-glass"
                    onClick={() => setOpen(!open)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                    }}
                >
                    <Languages size={15} />
                    <span>{current.label}</span>
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.6 }}>
                        <path d="M2 4 L5 7 L8 4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>

                {open && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                            onClick={() => setOpen(false)}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                right: 0,
                                minWidth: '160px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '12px',
                                padding: '6px',
                                zIndex: 100,
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            }}
                        >
                            <div style={{
                                padding: '6px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--text-tertiary)',
                            }}>
                                {t('lang.switchLang')}
                            </div>
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleSwitch(lang)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        width: '100%',
                                        padding: '10px',
                                        background: lang.code === locale ? 'var(--bg-glass)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        color: 'var(--text-primary)',
                                        fontSize: '13px',
                                        fontWeight: lang.code === locale ? 600 : 400,
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => { if (lang.code !== locale) e.target.style.background = 'var(--bg-glass)'; }}
                                    onMouseLeave={(e) => { if (lang.code !== locale) e.target.style.background = 'transparent'; }}
                                >
                                    <span style={{ fontSize: '16px' }}>{lang.flag}</span>
                                    <span>{lang.label}</span>
                                    {lang.code === locale && (
                                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--accent-green)' }}>✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
