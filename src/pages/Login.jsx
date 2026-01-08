import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LogIn, Sun, Moon, Zap } from 'lucide-react';
import LanguageSelector from '../components/ui/LanguageSelector';
import { api } from '../lib/api-client';

const Login = () => {
  const { t } = useTranslation();
  const { login, setCurrentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.auth.login(formData.email, formData.password);
      const { user, token } = response.data;

      // Store token and user
      localStorage.setItem('authToken', token);
      login(user);

      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (role) => {
    setError('');
    setLoading(true);

    try {
      const response = await api.auth.devLogin(role);
      const { user, token } = response.data;

      // Store token and user
      localStorage.setItem('authToken', token);
      login(user);

      navigate('/');
    } catch (err) {
      console.error('Dev login error:', err);
      setError(err.response?.data?.error || 'Dev login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        <LanguageSelector />
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-700" />
          )}
        </button>
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 md:p-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('app.name')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{t('app.tagline')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t('auth.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="admin@demo.com"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-4 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>{t('auth.login')}</span>
                </>
              )}
            </button>
          </form>

          {/* Dev Login Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-yellow-500" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick Dev Login
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDevLogin('admin')}
                disabled={loading}
                className="px-4 py-2.5 bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Admin
              </button>
              <button
                onClick={() => handleDevLogin('manager')}
                disabled={loading}
                className="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Manager
              </button>
              <button
                onClick={() => handleDevLogin('franchisee')}
                disabled={loading}
                className="px-4 py-2.5 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Franchisee
              </button>
              <button
                onClick={() => handleDevLogin('employee')}
                disabled={loading}
                className="px-4 py-2.5 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Employee
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
              Demo accounts with pre-configured roles
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Demo credentials: admin@demo.com / demo123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
