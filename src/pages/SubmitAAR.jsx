import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useAAR } from '../contexts/AARContext';
import { categories, years, colors, materials, damageTypes, jobTypes } from '../mocks/categories';
import { Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const aarSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  subCategory: z.string().min(1, 'Make/Brand is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.string().min(1, 'Year is required'),
  color: z.string().min(1, 'Color is required'),
  material: z.string().min(1, 'Material is required'),
  damageType: z.string().min(1, 'Damage type is required'),
  damageDescription: z.string().min(10, 'Description must be at least 10 characters'),
  jobType: z.string().min(1, 'Job type is required'),
  repairTime: z.number().min(0.1, 'Repair time must be greater than 0'),
  toolsUsed: z.string().min(1, 'Tools used is required'),
  notes: z.string().optional(),
  processDescription: z.string().min(20, 'Process description must be at least 20 characters'),
  paintDyeMix: z.string().optional(),
  areaValue: z.number().min(0, 'Area must be positive'),
  areaUnit: z.enum(['sqft', 'sqm']),
  liquidValue: z.number().min(0, 'Liquid must be positive'),
  liquidUnit: z.enum(['ml', 'oz', 'l', 'gal']),
  cost: z.number().min(0, 'Cost must be positive'),
});

const SubmitAAR = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { createAAR } = useAAR();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(aarSchema),
    defaultValues: {
      category: '',
      areaUnit: 'sqft',
      liquidUnit: 'ml',
    },
  });

  const category = watch('category');
  const selectedCategoryData = categories.find((c) => c.name === category);

  const onDropBefore = (acceptedFiles) => {
    const newPhotos = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setBeforePhotos([...beforePhotos, ...newPhotos]);
  };

  const onDropAfter = (acceptedFiles) => {
    const newPhotos = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setAfterPhotos([...afterPhotos, ...newPhotos]);
  };

  const { getRootProps: getRootPropsBefore, getInputProps: getInputPropsBefore } = useDropzone({
    onDrop: onDropBefore,
    accept: { 'image/*': [] },
  });

  const { getRootProps: getRootPropsAfter, getInputProps: getInputPropsAfter } = useDropzone({
    onDrop: onDropAfter,
    accept: { 'image/*': [] },
  });

  const onSubmit = (data) => {
    const aarData = {
      userId: currentUser.id,
      category: data.category,
      subCategory: data.subCategory,
      model: data.model,
      year: data.year,
      color: data.color,
      material: data.material,
      damageType: data.damageType,
      damageDescription: data.damageDescription,
      jobType: data.jobType,
      repairTime: parseFloat(data.repairTime),
      toolsUsed: data.toolsUsed.split(',').map((t) => t.trim()),
      notes: data.notes,
      processDescription: data.processDescription,
      paintDyeMix: data.paintDyeMix,
      area: { value: parseFloat(data.areaValue), unit: data.areaUnit },
      liquid: { value: parseFloat(data.liquidValue), unit: data.liquidUnit },
      cost: parseFloat(data.cost),
      photos: {
        before: beforePhotos.map((p) => p.preview),
        after: afterPhotos.map((p) => p.preview),
      },
    };

    createAAR(aarData);
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {t('aar.submit')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Document your repair work
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.category')} *
              </label>
              <select
                {...register('category')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-red-500 text-sm mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.subCategory')} *
              </label>
              <select
                {...register('subCategory')}
                disabled={!category}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="">Select Make/Brand</option>
                {selectedCategoryData &&
                  Object.keys(selectedCategoryData.subCategories).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
              </select>
              {errors.subCategory && (
                <p className="text-red-500 text-sm mt-1">{errors.subCategory.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.model')} *
              </label>
              <input
                {...register('model')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {errors.model && <p className="text-red-500 text-sm mt-1">{errors.model.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.year')} *
              </label>
              <select
                {...register('year')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {errors.year && <p className="text-red-500 text-sm mt-1">{errors.year.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.color')} *
              </label>
              <select
                {...register('color')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Color</option>
                {colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              {errors.color && <p className="text-red-500 text-sm mt-1">{errors.color.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.material')} *
              </label>
              <select
                {...register('material')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Material</option>
                {materials.map((material) => (
                  <option key={material} value={material}>
                    {material}
                  </option>
                ))}
              </select>
              {errors.material && (
                <p className="text-red-500 text-sm mt-1">{errors.material.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Damage Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Damage Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.damageType')} *
              </label>
              <select
                {...register('damageType')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Damage Type</option>
                {damageTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.damageType && (
                <p className="text-red-500 text-sm mt-1">{errors.damageType.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.jobType')} *
              </label>
              <select
                {...register('jobType')}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Job Type</option>
                {jobTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.jobType && (
                <p className="text-red-500 text-sm mt-1">{errors.jobType.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('aar.damageDescription')} *
            </label>
            <textarea
              {...register('damageDescription')}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {errors.damageDescription && (
              <p className="text-red-500 text-sm mt-1">{errors.damageDescription.message}</p>
            )}
          </div>
        </div>

        {/* Repair Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Repair Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.repairTime')} *
              </label>
              <input
                type="number"
                step="0.1"
                {...register('repairTime', { valueAsNumber: true })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {errors.repairTime && (
                <p className="text-red-500 text-sm mt-1">{errors.repairTime.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.cost')} *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('cost', { valueAsNumber: true })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {errors.cost && <p className="text-red-500 text-sm mt-1">{errors.cost.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('aar.toolsUsed')} * (comma separated)
            </label>
            <input
              {...register('toolsUsed')}
              placeholder="Heat gun, Leather filler, Color matching kit"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {errors.toolsUsed && (
              <p className="text-red-500 text-sm mt-1">{errors.toolsUsed.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('aar.processDescription')} *
            </label>
            <textarea
              {...register('processDescription')}
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {errors.processDescription && (
              <p className="text-red-500 text-sm mt-1">{errors.processDescription.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('aar.paintDyeMix')}
            </label>
            <textarea
              {...register('paintDyeMix')}
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Area *
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="0.01"
                  {...register('areaValue', { valueAsNumber: true })}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <select
                  {...register('areaUnit')}
                  className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="sqft">sq ft</option>
                  <option value="sqm">sq m</option>
                </select>
              </div>
              {errors.areaValue && (
                <p className="text-red-500 text-sm mt-1">{errors.areaValue.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Liquid *
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="0.01"
                  {...register('liquidValue', { valueAsNumber: true })}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <select
                  {...register('liquidUnit')}
                  className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="ml">ml</option>
                  <option value="oz">oz</option>
                  <option value="l">l</option>
                  <option value="gal">gal</option>
                </select>
              </div>
              {errors.liquidValue && (
                <p className="text-red-500 text-sm mt-1">{errors.liquidValue.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('aar.notes')}
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('aar.photos')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.before')}
              </label>
              <div
                {...getRootPropsBefore()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors"
              >
                <input {...getInputPropsBefore()} />
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drop photos here or click to browse
                </p>
              </div>
              {beforePhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {beforePhotos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo.preview}
                        alt={`Before ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setBeforePhotos(beforePhotos.filter((_, i) => i !== index))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('aar.after')}
              </label>
              <div
                {...getRootPropsAfter()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors"
              >
                <input {...getInputPropsAfter()} />
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drop photos here or click to browse
                </p>
              </div>
              {afterPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {afterPhotos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo.preview}
                        alt={`After ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setAfterPhotos(afterPhotos.filter((_, i) => i !== index))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
          >
            {t('common.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SubmitAAR;
