export const categories = [
  {
    name: 'Vehicle',
    subCategories: {
      'Toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander'],
      'Honda': ['Civic', 'Accord', 'CR-V', 'Pilot'],
      'Ford': ['F-150', 'Mustang', 'Explorer', 'Escape'],
      'Chevrolet': ['Silverado', 'Malibu', 'Equinox', 'Tahoe'],
      'BMW': ['3 Series', '5 Series', 'X3', 'X5'],
      'Mercedes-Benz': ['C-Class', 'E-Class', 'GLE', 'GLS'],
    },
  },
  {
    name: 'Boat',
    subCategories: {
      'SeaRay': ['Sundancer', 'Sport', 'Fly', 'SPX'],
      'Boston Whaler': ['Montauk', 'Outrage', 'Conquest', 'Realm'],
      'Bayliner': ['Element', 'VR5', 'VR6', 'Ciera'],
    },
  },
  {
    name: 'Motorcycle',
    subCategories: {
      'Harley-Davidson': ['Street Glide', 'Road King', 'Sportster', 'Fat Boy'],
      'Honda': ['CBR', 'Gold Wing', 'Africa Twin', 'Rebel'],
      'Yamaha': ['YZF-R1', 'MT-07', 'Tenere', 'V-Star'],
    },
  },
  {
    name: 'Apparel',
    subCategories: {
      'Jacket': ['Leather Jacket', 'Denim Jacket', 'Bomber Jacket'],
      'Pants': ['Jeans', 'Leather Pants', 'Chinos'],
      'Shoes': ['Boots', 'Sneakers', 'Dress Shoes'],
    },
  },
  {
    name: 'Accessory',
    subCategories: {
      'Bag': ['Handbag', 'Backpack', 'Briefcase'],
      'Belt': ['Leather Belt', 'Canvas Belt'],
      'Wallet': ['Bifold', 'Trifold', 'Card Holder'],
    },
  },
  {
    name: 'Furniture',
    subCategories: {
      'Sofa': ['Leather Sofa', 'Fabric Sofa', 'Sectional'],
      'Chair': ['Office Chair', 'Dining Chair', 'Recliner'],
      'Table': ['Dining Table', 'Coffee Table', 'Desk'],
    },
  },
  {
    name: 'Aircraft',
    subCategories: {
      'Cessna': ['172', '182', '206', '208'],
      'Piper': ['Cherokee', 'Archer', 'Seneca'],
      'Beechcraft': ['Baron', 'Bonanza', 'King Air'],
    },
  },
  {
    name: 'Marine',
    subCategories: {
      'Jet Ski': ['Yamaha WaveRunner', 'Sea-Doo', 'Kawasaki'],
      'Yacht': ['Motor Yacht', 'Sailing Yacht'],
    },
  },
  {
    name: 'Medical',
    subCategories: {
      'Equipment': ['Exam Table', 'Chair', 'Wheelchair'],
    },
  },
  {
    name: 'Commercial',
    subCategories: {
      'Restaurant': ['Booth', 'Bar Stool', 'Chair'],
      'Office': ['Reception Furniture', 'Waiting Room Chair'],
    },
  },
];

export const years = Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - i).toString());

export const colors = [
  'Black', 'White', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow',
  'Orange', 'Brown', 'Beige', 'Tan', 'Navy', 'Purple', 'Gold'
];

export const materials = [
  'Leather', 'Vinyl', 'Fabric', 'Plastic', 'Wood', 'Metal',
  'Carbon Fiber', 'Suede', 'Alcantara', 'Nylon'
];

export const damageTypes = [
  'Tear', 'Crack', 'Scuff', 'Burn', 'Stain', 'Fade', 'Scratch',
  'Dent', 'Puncture', 'Wear', 'Discoloration', 'Peel'
];

export const jobTypes = [
  'Repair', 'Restoration', 'Touch-up', 'Refinish', 'Recolor', 'Replacement'
];
