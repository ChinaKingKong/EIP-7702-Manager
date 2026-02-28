import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export default function LanguageSwitcher() {
    const { locale, toggleLocale, t } = useI18n();

    return (
        <button
            className="btn btn-secondary lang-switcher"
            onClick={toggleLocale}
            title={t('lang.switchLang')}
            style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                gap: '6px',
                display: 'inline-flex',
                alignItems: 'center',
            }}
        >
            <Languages size={15} />
            {locale === 'en' ? t('lang.zh') : t('lang.en')}
        </button>
    );
}
