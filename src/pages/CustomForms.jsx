import { useTranslation } from 'react-i18next';
import { FileEdit } from 'lucide-react';

const CustomForms = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
        <FileEdit className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('nav.customForms')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Custom form builder coming soon...
        </p>
      </div>
    </div>
  );
};

export default CustomForms;
