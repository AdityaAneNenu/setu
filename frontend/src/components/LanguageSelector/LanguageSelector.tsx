'use client';

import { useState } from 'react';
import styles from './LanguageSelector.module.css';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', name: 'മലയാളം (Malayalam)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'or', name: 'ଓଡ଼ିଆ (Odia)' },
];

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  showLabel?: boolean;
}

export default function LanguageSelector({ 
  value, 
  onChange, 
  label = 'Language',
  showLabel = true 
}: LanguageSelectorProps) {
  return (
    <div className={styles.container}>
      {showLabel && <label className={styles.label}>{label}</label>}
      <select 
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LANGUAGES.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Export languages for use in other components
export { LANGUAGES };
