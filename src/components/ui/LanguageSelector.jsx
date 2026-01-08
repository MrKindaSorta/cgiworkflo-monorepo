import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { api } from '../../lib/api-client';

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'ja', name: '日本語' },
  ];

  const handleLanguageChange = async (languageCode) => {
    // Change language immediately for instant UI update
    i18n.changeLanguage(languageCode);

    // Save to database if user is authenticated
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await api.users.updatePreferences({ language: languageCode });
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
      // Continue anyway - i18n already changed
    }
  };

  return (
    <div className="relative">
      <select
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="appearance-none bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code} className="dark:bg-gray-700 dark:text-gray-300">
            {lang.name}
          </option>
        ))}
      </select>
      <Globe className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    </div>
  );
};

export default LanguageSelector;
