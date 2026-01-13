// Unit conversion utilities

// Area conversions
export const convertArea = (value, fromUnit, toUnit) => {
  const sqmToSqft = 10.7639;

  if (fromUnit === toUnit) return value;

  if (fromUnit === 'sqm' && toUnit === 'sqft') {
    return value * sqmToSqft;
  }

  if (fromUnit === 'sqft' && toUnit === 'sqm') {
    return value / sqmToSqft;
  }

  return value;
};

// Liquid conversions
export const convertLiquid = (value, fromUnit, toUnit) => {
  const conversions = {
    ml: { ml: 1, oz: 0.033814, l: 0.001, gal: 0.000264172 },
    oz: { ml: 29.5735, oz: 1, l: 0.0295735, gal: 0.0078125 },
    l: { ml: 1000, oz: 33.814, l: 1, gal: 0.264172 },
    gal: { ml: 3785.41, oz: 128, l: 3.78541, gal: 1 },
  };

  if (fromUnit === toUnit) return value;

  return value * conversions[fromUnit][toUnit];
};

// Format display with units
export const formatArea = (value, unit) => {
  return `${value.toFixed(2)} ${unit}`;
};

export const formatLiquid = (value, unit) => {
  return `${value.toFixed(2)} ${unit}`;
};

// Get user preference from localStorage
export const getUnitPreference = () => {
  const prefs = localStorage.getItem('unitPreferences');
  return prefs ? JSON.parse(prefs) : { area: 'sqft', liquid: 'oz' };
};

// Save user preference to localStorage
export const saveUnitPreference = (preferences) => {
  localStorage.setItem('unitPreferences', JSON.stringify(preferences));
};

// Convert and format for display
export const displayArea = (areaData) => {
  // Handle null/undefined
  if (!areaData) return '--';

  const prefs = getUnitPreference();

  // Handle both object {value, unit} and array [{value, unit}] (for multidualfield)
  const areaObj = Array.isArray(areaData) ? areaData[0] : areaData;

  // Check if the extracted object has required properties
  if (!areaObj || !areaObj.value || !areaObj.unit) return '--';

  const converted = convertArea(areaObj.value, areaObj.unit, prefs.area);
  return formatArea(converted, prefs.area);
};

export const displayLiquid = (liquidData) => {
  // Handle null/undefined
  if (!liquidData) return '--';

  const prefs = getUnitPreference();

  // Handle both object {value, unit} and array [{value, unit}] (for multitriplefield)
  const liquidObj = Array.isArray(liquidData) ? liquidData[0] : liquidData;

  // Check if the extracted object has required properties
  if (!liquidObj || !liquidObj.value || !liquidObj.unit) return '--';

  const converted = convertLiquid(liquidObj.value, liquidObj.unit, prefs.liquid);
  return formatLiquid(converted, prefs.liquid);
};
