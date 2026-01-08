import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useAAR } from '../contexts/AARContext';
import { Link } from 'react-router-dom';
import { User, FileText } from 'lucide-react';

const Profile = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { aars } = useAAR();

  const userAARs = aars.filter((aar) => aar.userId === currentUser?.id);

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 md:p-5">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold">
            {currentUser?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              {currentUser?.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{currentUser?.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {t(`auth.${currentUser?.role}`)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {currentUser?.address}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 md:p-5">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {t('profile.myAARs')} ({userAARs.length})
        </h2>
        <div className="space-y-3">
          {userAARs.length > 0 ? (
            userAARs.map((aar) => (
              <Link
                key={aar.id}
                to={`/aar/${aar.id}`}
                className="block p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
              >
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {aar.category} - {aar.subCategory} {aar.model}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {new Date(aar.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-6">
              No AARs yet. <Link to="/submit" className="text-primary-600 dark:text-primary-400 hover:underline">Create your first one</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
