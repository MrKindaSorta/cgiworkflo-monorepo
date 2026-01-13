import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useAAR } from '../contexts/AARContext';
import DynamicField from '../components/form/DynamicField';
import { Settings } from 'lucide-react';
import { api } from '../lib/api-client';
import { shouldShowField } from '../utils/conditionalFields';

// Default schema sections
const DEFAULT_SECTIONS = [
  { id: 'basic', name: 'Basic Information', order: 0 },
  { id: 'damage', name: 'Damage Information', order: 1 },
  { id: 'repair', name: 'Repair Details', order: 2 },
  { id: 'photos', name: 'Photos & Attachments', order: 3 },
];

const SubmitAAR = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();
  const { createAAR } = useAAR();
  const [photos, setPhotos] = useState({});
  const [formSchema, setFormSchema] = useState(null);

  // Check if user can customize forms (Admin/Manager only)
  const canCustomize = hasPermission('custom_forms') || hasPermission('all');

  // Load form schema from API (with localStorage fallback)
  useEffect(() => {
    const loadFormSchema = async () => {
      try {
        const response = await api.customForms.getActive();

        if (response.data.form) {
          // Use database schema with form ID included
          setFormSchema({
            ...response.data.form.schema,
            formId: response.data.form.id, // Include the form ID from database
          });
        } else {
          // No form in database - check localStorage
          const localSchema = localStorage.getItem('aar-form-schema');
          if (localSchema) {
            setFormSchema(JSON.parse(localSchema));
          } else {
            // No custom form - use empty schema (shows message)
            setFormSchema({ sections: DEFAULT_SECTIONS, fields: [] });
          }
        }
      } catch (error) {
        console.error('Error loading form:', error);
        // Fallback to localStorage
        const localSchema = localStorage.getItem('aar-form-schema');
        if (localSchema) {
          setFormSchema(JSON.parse(localSchema));
        } else {
          setFormSchema({ sections: DEFAULT_SECTIONS, fields: [] });
        }
      }
    };

    loadFormSchema();
  }, []);

  // Generate Zod schema dynamically based on form schema
  const zodSchema = useMemo(() => {
    if (!formSchema || !formSchema.fields) {
      // Basic fallback schema if no custom form exists
      return z.object({
        category: z.string().min(1, 'Category is required'),
        model: z.string().min(1, 'Model is required'),
        damageDescription: z.string().min(10, 'Description must be at least 10 characters'),
      });
    }

    const schemaFields = {};
    formSchema.fields.forEach((field) => {
      let fieldSchema;

      // Conditional fields with required=true should be optional in schema
      // They'll be validated only when visible
      const isConditional = field.conditional?.enabled;

      switch (field.type) {
        case 'text':
          fieldSchema = z.string();
          if (field.required && !isConditional) {
            fieldSchema = fieldSchema.min(1, `${field.label} is required`);
          } else {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'number':
          fieldSchema = z.number();
          if (field.validation?.min !== undefined) {
            fieldSchema = fieldSchema.min(field.validation.min, `Minimum value is ${field.validation.min}`);
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = fieldSchema.max(field.validation.max, `Maximum value is ${field.validation.max}`);
          }
          if (!field.required || isConditional) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'textarea':
          fieldSchema = z.string();
          if (field.required && !isConditional) {
            if (field.validation?.minLength) {
              fieldSchema = fieldSchema.min(
                field.validation.minLength,
                `Minimum length is ${field.validation.minLength} characters`
              );
            } else {
              fieldSchema = fieldSchema.min(1, `${field.label} is required`);
            }
          } else {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'select':
        case 'smartselect':
        case 'date':
          fieldSchema = z.string();
          if (field.required && !isConditional) {
            fieldSchema = fieldSchema.min(1, `${field.label} is required`);
          } else {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'multiselect':
        case 'smartmultiselect':
          fieldSchema = z.array(z.string());
          if (field.required && !isConditional) {
            fieldSchema = fieldSchema.min(1, `At least one ${field.label} is required`);
          } else {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'dualfield':
          fieldSchema = z.object({
            value: z.string(),
            unit: z.string(),
          });
          if (!field.required || isConditional) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'multidualfield':
          fieldSchema = z.array(
            z.object({
              value: z.string(),
              unit: z.string(),
            })
          );
          if (field.required && !isConditional) {
            fieldSchema = fieldSchema.min(1, `At least one ${field.label} is required`);
          } else {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'triplefield':
          fieldSchema = z.object({
            value: z.string(),
            unit: z.string(),
            amount: z.union([z.string(), z.number()]),
          });
          if (!field.required || isConditional) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'multitriplefield':
          fieldSchema = z.array(
            z.object({
              value: z.string(),
              unit: z.string(),
              amount: z.union([z.string(), z.number()]),
            })
          );
          if (field.required && !isConditional) {
            fieldSchema = fieldSchema.min(1, `At least one ${field.label} is required`);
          } else {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case 'file':
          // File fields are handled separately (not in Zod schema)
          if (field.required && !isConditional) {
            fieldSchema = z.any().refine(() => true, `${field.label} is required`);
          } else {
            fieldSchema = z.any().optional();
          }
          break;

        default:
          fieldSchema = z.any().optional();
      }

      schemaFields[field.id] = fieldSchema;
    });

    return z.object(schemaFields);
  }, [formSchema]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(zodSchema),
  });

  // Watch all form values for conditional logic evaluation
  const allFormValues = watch();

  // Get sections from schema or use defaults
  const sections = formSchema?.sections || DEFAULT_SECTIONS;

  // Get fields for a section (filtered by conditional logic)
  const getFieldsForSection = (sectionId) => {
    if (!formSchema || !formSchema.fields) return [];
    return formSchema.fields
      .filter((f) => f.section === sectionId)
      .filter((f) => shouldShowField(f, allFormValues)) // Apply conditional logic
      .sort((a, b) => a.order - b.order);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState(null);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmitError(null);

    try {
      // Build FormData with all form fields + photos
      const formData = new FormData();

      // Add form data as JSON string
      formData.append('formData', JSON.stringify(data));
      formData.append('formId', formSchema.formId || 'aar-form');
      formData.append('formVersion', formSchema.version || '1.0');

      // Add photo files with field mapping
      const photoMetadata = {};
      Object.keys(photos).forEach((fieldId) => {
        photos[fieldId].forEach((file, index) => {
          formData.append(`photo_${fieldId}_${index}`, file);
          if (!photoMetadata[fieldId]) photoMetadata[fieldId] = [];
          photoMetadata[fieldId].push({
            filename: file.name,
            size: file.size,
            type: file.type,
          });
        });
      });

      formData.append('photoMetadata', JSON.stringify(photoMetadata));

      // Upload with progress tracking
      const result = await createAAR(formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      // Success! Navigate to AAR detail or browse page
      navigate(result.id ? `/aar/${result.id}` : '/');
    } catch (error) {
      console.error('Submission failed:', error);
      setSubmitError(
        error.validationErrors
          ? 'Please fix the validation errors and try again.'
          : error.message || 'Failed to submit AAR. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while schema loads
  if (formSchema === null) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading form...</p>
        </div>
      </div>
    );
  }

  // Show message if no fields configured
  if (!formSchema.fields || formSchema.fields.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-5 md:p-6 text-center">
          <Settings className="w-12 h-12 mx-auto text-yellow-600 dark:text-yellow-400 mb-3" />
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Form Fields Configured
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The Submit AAR form has no fields yet. Please configure the form in the Customize page.
          </p>
          {canCustomize && (
            <Link
              to="/customize"
              className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Go to Customize
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            {t('aar.submit')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Document your repair work
          </p>
        </div>
        {canCustomize && (
          <Link
            to="/customize"
            className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">Customize Form</span>
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
        {sections.map((section) => {
          const sectionFields = getFieldsForSection(section.id);
          if (sectionFields.length === 0) return null;

          return (
            <div
              key={section.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-5 shadow-sm space-y-3"
            >
              <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                {section.name}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {sectionFields.map((field) => (
                  <div
                    key={field.id}
                    className={
                      field.type === 'textarea' ||
                      field.type === 'file' ||
                      field.type === 'dualfield' ||
                      field.type === 'multidualfield' ||
                      field.type === 'triplefield' ||
                      field.type === 'multitriplefield'
                        ? 'md:col-span-2'
                        : ''
                    }
                  >
                    <DynamicField
                      field={field}
                      register={register}
                      errors={errors}
                      watch={watch}
                      setValue={setValue}
                      photos={photos}
                      setPhotos={setPhotos}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Error Message */}
        {submitError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">
            {submitError}
          </div>
        )}

        {/* Upload Progress */}
        {isSubmitting && uploadProgress > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Uploading... {uploadProgress}%
              </span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={isSubmitting}
            className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              t('common.submit')
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SubmitAAR;
