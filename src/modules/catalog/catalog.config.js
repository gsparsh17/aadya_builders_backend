/**
 * Catalog configuration - the single source of truth for what is listed on
 * the platform. Clients render their category browsing, search tabs and
 * filter forms from this, so a new property type only needs to be added here
 * (and to the property schema enum).
 */

const PROPERTY_TYPES = [
  { key: 'apartment', label: 'Flat / Apartment', plural: 'Flats & Apartments', category: 'residential', description: 'Units in residential societies and towers', icon: 'building', imageKey: 'apartment', supportsBhk: true, supportsFurnishing: true },
  { key: 'independent_house', label: 'Independent House', plural: 'Independent Houses', category: 'residential', description: 'Standalone homes on their own land', icon: 'house', imageKey: 'house', supportsBhk: true, supportsFurnishing: true },
  { key: 'villa', label: 'Villa', plural: 'Villas', category: 'residential', description: 'Premium homes, often in gated communities', icon: 'villa', imageKey: 'villa', supportsBhk: true, supportsFurnishing: true },
  { key: 'builder_floor', label: 'Builder Floor', plural: 'Builder Floors', category: 'residential', description: 'An entire floor in a low-rise building', icon: 'layers', imageKey: 'builder_floor', supportsBhk: true, supportsFurnishing: true },
  { key: 'plot', label: 'Plot / Land', plural: 'Plots & Land', category: 'residential', description: 'Residential plots and land parcels', icon: 'map', imageKey: 'plot', supportsBhk: false, supportsFurnishing: false },
  { key: 'farmhouse', label: 'Farmhouse', plural: 'Farmhouses', category: 'agricultural', description: 'Homes with open land on the city outskirts', icon: 'tree', imageKey: 'farmhouse', supportsBhk: true, supportsFurnishing: true },
  { key: 'pg', label: 'PG / Hostel', plural: 'PGs & Hostels', category: 'residential', description: 'Paying-guest rooms with shared facilities', icon: 'bed', imageKey: 'pg', supportsBhk: false, supportsFurnishing: true },
  { key: 'co_living', label: 'Co-living', plural: 'Co-living Spaces', category: 'residential', description: 'Furnished private rooms in managed homes', icon: 'people', imageKey: 'pg', supportsBhk: false, supportsFurnishing: true },
  { key: 'office', label: 'Office Space', plural: 'Office Spaces', category: 'commercial', description: 'Offices, co-working and IT spaces', icon: 'briefcase', imageKey: 'office', supportsBhk: false, supportsFurnishing: true },
  { key: 'shop', label: 'Shop / Showroom', plural: 'Shops & Showrooms', category: 'commercial', description: 'Street-facing retail and showrooms', icon: 'shop', imageKey: 'shop', supportsBhk: false, supportsFurnishing: true },
  { key: 'retail', label: 'Retail Space', plural: 'Retail Spaces', category: 'commercial', description: 'Units in malls and high streets', icon: 'shop', imageKey: 'shop', supportsBhk: false, supportsFurnishing: true },
  { key: 'warehouse', label: 'Warehouse / Godown', plural: 'Warehouses', category: 'industrial', description: 'Storage and logistics spaces', icon: 'box', imageKey: 'warehouse', supportsBhk: false, supportsFurnishing: false },
  { key: 'hotel', label: 'Hotel / Resort', plural: 'Hotels & Resorts', category: 'commercial', description: 'Hospitality properties', icon: 'building', imageKey: 'project', supportsBhk: false, supportsFurnishing: true },
  { key: 'guest_house', label: 'Guest House', plural: 'Guest Houses', category: 'commercial', description: 'Guest houses and service apartments', icon: 'house', imageKey: 'house', supportsBhk: false, supportsFurnishing: true },
];

const BUY_PRICE_PRESETS = [2500000, 5000000, 7500000, 10000000, 20000000, 50000000];
const RENT_PRICE_PRESETS = [5000, 10000, 20000, 35000, 50000, 100000];

// A segment is what the user picks first ("I want to Buy / Rent / ...").
// `purposes` and `propertyTypes` together define which listings belong to it.
const SEGMENTS = [
  {
    key: 'buy',
    label: 'Buy',
    tagline: 'Homes and plots for sale',
    purposes: ['buy', 'new_launch'],
    propertyTypes: ['apartment', 'independent_house', 'villa', 'builder_floor', 'plot', 'farmhouse'],
    priceMode: 'total',
    pricePresets: BUY_PRICE_PRESETS,
  },
  {
    key: 'rent',
    label: 'Rent',
    tagline: 'Homes for rent',
    purposes: ['rent'],
    propertyTypes: ['apartment', 'independent_house', 'villa', 'builder_floor', 'farmhouse'],
    priceMode: 'monthly',
    pricePresets: RENT_PRICE_PRESETS,
  },
  {
    key: 'pg',
    label: 'PG / Co-living',
    tagline: 'Rooms, PGs and co-living',
    purposes: ['rent'],
    propertyTypes: ['pg', 'co_living'],
    priceMode: 'monthly',
    pricePresets: [3000, 5000, 8000, 12000, 20000],
  },
  {
    key: 'plots',
    label: 'Plots & Land',
    tagline: 'Residential plots and land',
    purposes: ['buy', 'land', 'new_launch'],
    propertyTypes: ['plot', 'farmhouse'],
    priceMode: 'total',
    pricePresets: BUY_PRICE_PRESETS,
  },
  {
    key: 'commercial',
    label: 'Commercial',
    tagline: 'Offices, shops and warehouses',
    purposes: ['commercial_buy', 'commercial_lease', 'buy', 'rent'],
    propertyTypes: ['office', 'shop', 'retail', 'warehouse', 'hotel', 'guest_house'],
    priceMode: 'total',
    pricePresets: BUY_PRICE_PRESETS,
  },
];

const SORT_OPTIONS = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'newest', label: 'Newest first' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'price_per_sqft_asc', label: 'Price / sq.ft: low to high' },
  { key: 'area_desc', label: 'Largest area first' },
];

const FURNISHING_OPTIONS = [
  { key: 'furnished', label: 'Furnished' },
  { key: 'semi_furnished', label: 'Semi-furnished' },
  { key: 'unfurnished', label: 'Unfurnished' },
];

const POSTED_BY_OPTIONS = [
  { key: 'individual', label: 'Owner' },
  { key: 'dealer', label: 'Agent' },
  { key: 'builder', label: 'Builder' },
];

const CONSTRUCTION_STATUS_OPTIONS = [
  { key: 'ready_to_move', label: 'Ready to move' },
  { key: 'under_construction', label: 'Under construction' },
  { key: 'new_launch', label: 'New launch' },
];

const getSegment = (key) => SEGMENTS.find((s) => s.key === key);

module.exports = {
  PROPERTY_TYPES,
  SEGMENTS,
  SORT_OPTIONS,
  FURNISHING_OPTIONS,
  POSTED_BY_OPTIONS,
  CONSTRUCTION_STATUS_OPTIONS,
  getSegment,
};
