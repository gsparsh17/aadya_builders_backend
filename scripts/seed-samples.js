/**
 * Seed demo content so every screen of the app has something real to show:
 * listings in each launch city, builder projects (some with bookable plot
 * layouts), video shorts, 360° tours and floor plans.
 *
 *   npm run seed:samples                 upload media + create records
 *   npm run seed:samples:remove          delete every sample record + media
 *
 * Media comes from ../sample-assets (pano/, interior/, plans/, sites/,
 * videos/, made by sample-assets/generate_media.py); override with
 * --assets=<dir>. Exterior photos default to the app's bundled
 * images (../aadya_acres/assets/images); override with --exteriors=<dir>.
 *
 * Everything created here is tagged so it can be removed cleanly:
 * users use the @samples.aadyaacres.in email domain, properties carry a
 * SAMPLE- propertyCode, and media lives under the aadya/samples folder.
 * Re-running first removes the previous sample set, then recreates it.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const cloudinary = require('cloudinary').v2;
const User = require('../src/modules/users/user.model');
const Property = require('../src/modules/properties/property.model');
const Project = require('../src/modules/projects/project.model');
const Layout = require('../src/modules/layouts/layout.model');
const Plot = require('../src/modules/layouts/plot.model');
const Short = require('../src/modules/shorts/short.model');
const Lead = require('../src/modules/leads/lead.model');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);

const EMAIL_DOMAIN = '@samples.aadyaacres.in';
const CODE_PREFIX = 'SAMPLE-';
const MEDIA_FOLDER = 'aadya/samples';
const DAY = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------------ helpers

let rngState = 20261109;
const rand = () => {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (a, b) => Math.round(a + rand() * (b - a));
const sample = (list, n) => [...list].sort(() => rand() - 0.5).slice(0, n);
const roundTo = (v, step) => Math.round(v / step) * step;
const jitter = ([lng, lat], d = 0.012) => [+(lng + (rand() - 0.5) * d).toFixed(6), +(lat + (rand() - 0.5) * d).toFixed(6)];

// ------------------------------------------------------------------ data

const CITIES = [
  { city: 'Kanpur', state: 'Uttar Pradesh', code: 'KNP', rate: 5200, rent: 14, plotRate: 2600, localities: [
    ['Swaroop Nagar', [80.317, 26.4826], '208002'], ['Civil Lines', [80.35, 26.47], '208001'], ['Kidwai Nagar', [80.324, 26.437], '208011'],
    ['Kalyanpur', [80.256, 26.516], '208017'], ['Shyam Nagar', [80.37, 26.43], '208013']] },
  { city: 'Lucknow', state: 'Uttar Pradesh', code: 'LKO', rate: 7200, rent: 18, plotRate: 3400, localities: [
    ['Gomti Nagar', [80.993, 26.856], '226010'], ['Hazratganj', [80.946, 26.85], '226001'], ['Aliganj', [80.944, 26.89], '226024'],
    ['Indira Nagar', [81.0, 26.88], '226016'], ['Sushant Golf City', [80.99, 26.78], '226030']] },
  { city: 'Ayodhya', state: 'Uttar Pradesh', code: 'AYD', rate: 4600, rent: 11, plotRate: 2900, localities: [
    ['Civil Lines', [82.199, 26.786], '224001'], ['Devkali', [82.165, 26.773], '224001'], ['Ramkot', [82.194, 26.795], '224123']] },
  { city: 'Prayagraj', state: 'Uttar Pradesh', code: 'PRJ', rate: 4800, rent: 12, plotRate: 2400, localities: [
    ['Civil Lines', [81.833, 25.453], '211001'], ['Jhunsi', [81.9, 25.44], '211019'], ['Naini', [81.88, 25.39], '211008']] },
  { city: 'Varanasi', state: 'Uttar Pradesh', code: 'VNS', rate: 5400, rent: 13, plotRate: 2700, localities: [
    ['Sigra', [82.99, 25.317], '221010'], ['Lanka', [83.0, 25.28], '221005'], ['Sarnath', [83.023, 25.381], '221007']] },
  { city: 'Noida', state: 'Uttar Pradesh', code: 'NOI', rate: 9200, rent: 24, plotRate: 6200, localities: [
    ['Sector 150', [77.48, 28.42], '201310'], ['Sector 62', [77.365, 28.627], '201309'], ['Sector 137', [77.406, 28.51], '201305'],
    ['Noida Extension', [77.43, 28.6], '201318']] },
  { city: 'Delhi', state: 'Delhi', code: 'DEL', rate: 17500, rent: 42, plotRate: 0, localities: [
    ['Dwarka', [77.046, 28.592], '110075'], ['Vasant Kunj', [77.159, 28.52], '110070'], ['Saket', [77.215, 28.524], '110017'],
    ['Rohini', [77.115, 28.738], '110085']] },
  { city: 'Gurugram', state: 'Haryana', code: 'GGN', rate: 14500, rent: 38, plotRate: 0, localities: [
    ['Golf Course Road', [77.1, 28.45], '122002'], ['Sohna Road', [77.04, 28.41], '122018'], ['DLF Phase 2', [77.09, 28.49], '122002'],
    ['Sector 65', [77.07, 28.4], '122102']] },
  { city: 'Mumbai', state: 'Maharashtra', code: 'MUM', rate: 29000, rent: 75, plotRate: 0, localities: [
    ['Bandra West', [72.83, 19.06], '400050'], ['Andheri West', [72.83, 19.136], '400053'], ['Powai', [72.905, 19.117], '400076'],
    ['Thane West', [72.97, 19.2], '400601']] },
  { city: 'Pune', state: 'Maharashtra', code: 'PUN', rate: 10500, rent: 28, plotRate: 0, localities: [
    ['Hinjewadi', [73.738, 18.591], '411057'], ['Baner', [73.787, 18.559], '411045'], ['Kharadi', [73.94, 18.551], '411014'],
    ['Koregaon Park', [73.893, 18.536], '411001']] },
  { city: 'Bengaluru', state: 'Karnataka', code: 'BLR', rate: 11500, rent: 32, plotRate: 0, localities: [
    ['Whitefield', [77.75, 12.97], '560066'], ['Indiranagar', [77.641, 12.978], '560038'], ['HSR Layout', [77.638, 12.912], '560102'],
    ['Sarjapur Road', [77.69, 12.9], '560035']] },
  { city: 'Hyderabad', state: 'Telangana', code: 'HYD', rate: 9800, rent: 27, plotRate: 0, localities: [
    ['Gachibowli', [78.349, 17.44], '500032'], ['Kondapur', [78.364, 17.47], '500084'], ['Jubilee Hills', [78.407, 17.432], '500033'],
    ['Kokapet', [78.333, 17.396], '500075']] },
];

const USERS = [
  { key: 'builder', name: 'Aadya Signature Developers', role: 'builder', phone: '6000400101',
    companyDetails: { companyName: 'Aadya Signature Developers', designation: 'Sales Head', yearEstablished: 2009, website: 'https://aadyaacres.in' } },
  { key: 'builder2', name: 'Skyline Habitat Builders', role: 'builder', phone: '6000400102',
    companyDetails: { companyName: 'Skyline Habitat Builders', designation: 'Director', yearEstablished: 2014 } },
  { key: 'dealer', name: 'Rohit Verma (HomeKey Realty)', role: 'dealer', phone: '6000400103',
    companyDetails: { companyName: 'HomeKey Realty', designation: 'Partner', yearEstablished: 2016 } },
  { key: 'owner', name: 'Ananya Mishra', role: 'owner', phone: '6000400104' },
  { key: 'owner2', name: 'Vikram Rao', role: 'owner', phone: '6000400105' },
  { key: 'buyer', name: 'Sample Buyer', role: 'buyer', phone: '6000400106' },
];

const AMENITY_SETS = {
  apartment: ['lift', 'parking', 'power_backup', 'security', 'gym', 'swimming_pool', 'club_house', 'park', 'play_area', 'intercom',
    'fire_safety', 'visitor_parking', 'rain_water_harvesting', 'piped_gas'],
  house: ['parking', 'power_backup', 'security', 'park', 'water_storage', 'rain_water_harvesting', 'piped_gas', 'wifi'],
  commercial: ['lift', 'parking', 'power_backup', 'security', 'air_conditioning', 'fire_safety', 'service_lift', 'wifi', 'visitor_parking'],
  plot: ['security', 'park', 'water_storage', 'power_backup', 'rain_water_harvesting'],
};

const NEARBY = [
  ['school', ['Delhi Public School', 'Kendriya Vidyalaya', 'St. Mary\'s Convent', 'Ryan International School']],
  ['hospital', ['Apollo Clinic', 'City Care Hospital', 'Regency Hospital', 'Max Healthcare']],
  ['metro', ['Metro Station']],
  ['market', ['Central Market', 'Sabzi Mandi', 'Main Bazaar']],
  ['mall', ['Phoenix Mall', 'City Centre Mall', 'Z Square Mall']],
  ['railway', ['Railway Station']],
];

// Listing templates. Each city gets six of these, rotated so cities differ.
const TEMPLATES = [
  { purpose: 'buy', type: 'apartment', bhk: 2, area: [980, 1250], titles: ['Sunlit 2 BHK with park view', 'Corner 2 BHK in a gated society', 'Move-in ready 2 BHK near metro'] },
  { purpose: 'buy', type: 'apartment', bhk: 3, area: [1450, 1850], titles: ['Spacious 3 BHK with two balconies', 'Premium 3 BHK in a high-rise', 'East-facing 3 BHK with clubhouse access'] },
  { purpose: 'rent', type: 'apartment', bhk: 2, area: [900, 1200], titles: ['Furnished 2 BHK for families', 'Semi-furnished 2 BHK, ready to move', 'Bright 2 BHK on a high floor'] },
  { purpose: 'buy', type: 'villa', bhk: 4, area: [2400, 3600], titles: ['Modern 4 BHK villa with private lawn', 'Duplex villa with terrace garden', 'Independent 4 BHK villa in a gated enclave'] },
  { purpose: 'land', type: 'plot', bhk: 0, area: [1200, 2700], titles: ['Residential plot in an approved layout', 'East-facing plot on a 30 ft road', 'Corner plot near the highway'] },
  { purpose: 'buy', type: 'builder_floor', bhk: 3, area: [1300, 1700], titles: ['Stilt-parking 3 BHK builder floor', 'Newly built 3 BHK floor with lift', 'Independent floor with private terrace'] },
  { purpose: 'buy', type: 'independent_house', bhk: 3, area: [1800, 2600], titles: ['Independent house with car parking', 'Vastu-compliant 3 BHK house', 'Double-storey home near the market'] },
  { purpose: 'rent', type: 'pg', bhk: 1, area: [220, 320], titles: ['Furnished PG with meals and Wi-Fi', 'Single-occupancy PG near IT park', 'Women\'s PG with housekeeping'] },
  { purpose: 'commercial_lease', type: 'office', bhk: 0, area: [1200, 2400], titles: ['Furnished office with 40 workstations', 'Grade-A office space on lease', 'Plug-and-play office near the metro'] },
  { purpose: 'commercial_buy', type: 'shop', bhk: 0, area: [250, 600], titles: ['Ground-floor shop on the main road', 'High-footfall retail shop', 'Corner shop in a busy market'] },
  { purpose: 'rent', type: 'villa', bhk: 4, area: [2600, 3400], titles: ['Furnished villa for rent with garden', 'Luxury villa on lease, gated community'] },
  { purpose: 'new_launch', type: 'apartment', bhk: 3, area: [1500, 1900], titles: ['New launch 3 BHK, early-bird price', 'Pre-launch 3 BHK in a 40-acre township'] },
];

const EXTERIOR = {
  apartment: ['apartment.jpg', 'project.jpg', 'home_hero.jpg'],
  villa: ['villa.jpg', 'house.jpg', 'onboard_b.jpg'],
  independent_house: ['house.jpg', 'villa.jpg', 'onboard_a.jpg'],
  builder_floor: ['builder_floor.jpg', 'house.jpg', 'apartment.jpg'],
  plot: ['plot.jpg', 'farmhouse.jpg'],
  pg: ['pg.jpg', 'apartment.jpg'],
  office: ['office.jpg', 'warehouse.jpg'],
  shop: ['shop.jpg', 'office.jpg'],
};

const PLAN_FOR = { 1: '1bhk', 2: '2bhk', 3: '3bhk', 4: 'villa' };

// ------------------------------------------------------------------ media

async function uploadAll(assetsDir, exteriorsDir) {
  const manifestPath = path.join(assetsDir, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const jobs = [];
  const add = (group, file, resourceType) => jobs.push({ group, file, resourceType });
  for (const g of ['pano', 'interior', 'plans', 'sites']) {
    for (const f of fs.readdirSync(path.join(assetsDir, g))) if (/\.(jpg|png)$/.test(f)) add(g, path.join(assetsDir, g, f), 'image');
  }
  for (const f of fs.readdirSync(path.join(assetsDir, 'videos'))) if (f.endsWith('.mp4')) add('videos', path.join(assetsDir, 'videos', f), 'video');
  for (const f of new Set(Object.values(EXTERIOR).flat())) add('exterior', path.join(exteriorsDir, f), 'image');

  let uploaded = 0;
  for (const job of jobs) {
    const name = path.basename(job.file).replace(/\.\w+$/, '');
    const key = `${job.group}/${name}`;
    if (manifest[key]) continue;
    const res = await cloudinary.uploader.upload(job.file, {
      folder: `${MEDIA_FOLDER}/${job.group}`,
      public_id: name,
      overwrite: true,
      resource_type: job.resourceType,
    });
    manifest[key] = res.secure_url;
    uploaded++;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    process.stdout.write(`  uploaded ${key}\n`);
  }
  console.log(`Media ready (${uploaded} uploaded, ${Object.keys(manifest).length} total)`);
  return manifest;
}

const videoThumb = (url) => url.replace('/video/upload/', '/video/upload/so_1,w_540,h_960,c_fill/').replace(/\.mp4$/, '.jpg');

// ------------------------------------------------------------------ remove

async function removeSamples({ media }) {
  const users = await User.find({ email: { $regex: `${EMAIL_DOMAIN.replace(/\./g, '\\.')}$` } }).select('_id');
  const userIds = users.map((u) => u._id);
  const projects = await Project.find({ builder: { $in: userIds } }).select('_id');
  const projectIds = projects.map((p) => p._id);
  const layouts = await Layout.find({ projectId: { $in: projectIds } }).select('_id');
  const properties = await Property.find({ $or: [{ owner: { $in: userIds } }, { propertyCode: { $regex: `^${CODE_PREFIX}` } }] }).select('_id');
  const propertyIds = properties.map((p) => p._id);

  const counts = {
    plots: (await Plot.deleteMany({ layoutId: { $in: layouts.map((l) => l._id) } })).deletedCount,
    layouts: (await Layout.deleteMany({ _id: { $in: layouts.map((l) => l._id) } })).deletedCount,
    shorts: (await Short.deleteMany({ $or: [{ owner: { $in: userIds } }, { property: { $in: propertyIds } }] })).deletedCount,
    leads: (await Lead.deleteMany({ property: { $in: propertyIds } })).deletedCount,
    properties: (await Property.deleteMany({ _id: { $in: propertyIds } })).deletedCount,
    projects: (await Project.deleteMany({ _id: { $in: projectIds } })).deletedCount,
    users: (await User.deleteMany({ _id: { $in: userIds } })).deletedCount,
  };
  console.log('Removed sample records:', counts);

  if (media) {
    for (const type of ['image', 'video']) {
      await cloudinary.api.delete_resources_by_prefix(`${MEDIA_FOLDER}/`, { resource_type: type }).catch((e) => console.warn(`  media (${type}):`, e.message));
    }
    console.log(`Removed media under ${MEDIA_FOLDER}/`);
  }
}

// ------------------------------------------------------------------ seed

async function createUsers() {
  const users = {};
  for (const u of USERS) {
    const email = `${u.key}${EMAIL_DOMAIN}`;
    const clash = await User.findOne({ phone: u.phone, email: { $ne: email } }).select('_id');
    if (clash) throw new Error(`Phone ${u.phone} already belongs to a real user; change it in USERS before seeding.`);
    const doc = new User({
      name: u.name,
      email,
      phone: u.phone,
      password: crypto.randomBytes(18).toString('base64url'),
      role: u.role,
      isVerified: true,
      emailVerified: true,
      phoneVerified: true,
      companyDetails: u.companyDetails,
      address: { city: 'Kanpur', state: 'Uttar Pradesh', country: 'India' },
    });
    await doc.save();
    users[u.key] = doc;
  }
  return users;
}

function describe(t, loc, c, bhk, area) {
  const lines = {
    apartment: `A well-planned ${bhk} BHK in ${loc}, ${c.city}, with cross ventilation, a modular kitchen and covered parking. The society has round-the-clock security, power backup and a landscaped central garden.`,
    villa: `A ${bhk} BHK villa spread over ${area.toLocaleString('en-IN')} sq.ft in ${loc}. Double-height living room, private lawn, Italian marble flooring and a dedicated servant room. Gated community with clubhouse.`,
    independent_house: `Independent ${bhk} BHK house in a quiet lane of ${loc}. Two car parks, rooftop access, borewell plus municipal water and all daily needs within walking distance.`,
    builder_floor: `Freshly built ${bhk} BHK floor in ${loc} with lift, stilt parking and a private terrace option. Ideal for families who want an independent feel without maintaining a whole house.`,
    plot: `Clear-title residential plot of ${area.toLocaleString('en-IN')} sq.ft in ${loc}, ${c.city}. Wide internal roads, underground drainage and electricity connections at the boundary. Registry ready.`,
    pg: `Fully furnished PG in ${loc} with daily housekeeping, three meals, high-speed Wi-Fi and laundry. Biometric entry and CCTV for safety.`,
    office: `Ready-to-move office of ${area.toLocaleString('en-IN')} sq.ft in ${loc} with workstations, two cabins, a meeting room and pantry. 100% power backup and ample visitor parking.`,
    shop: `Main-road commercial shop in ${loc} with high frontage and steady footfall. Suitable for retail, clinic, bank ATM or showroom.`,
  };
  return `${lines[t.type]} Site visits available all days; call or schedule a tour from the app.`;
}

function buildProperty(t, c, li, owner, ownerType, manifest, idx) {
  const [locality, center, pincode] = c.localities[li % c.localities.length];
  const area = roundTo(between(t.area[0], t.area[1]), 10);
  const isRent = ['rent', 'commercial_lease'].includes(t.purpose);
  const commercial = ['office', 'shop'].includes(t.type);
  const rateFactor = { villa: 1.25, plot: 0.55, independent_house: 1.05, builder_floor: 0.95, shop: 1.6, office: 1.15 }[t.type] || 1;
  let price;
  if (t.type === 'pg') price = roundTo(between(6500, 11000) * (c.rent / 20), 500);
  else if (isRent) price = roundTo(area * c.rent * rateFactor, 500);
  else price = roundTo(area * c.rate * rateFactor * (0.92 + rand() * 0.16), 50000);

  const ext = EXTERIOR[t.type];
  const interiors = Object.keys(manifest).filter((k) => k.startsWith('interior/'));
  const images = [
    { url: manifest[`exterior/${ext[idx % ext.length].replace('.jpg', '')}`], caption: 'Exterior', isPrimary: true, order: 0 },
    ...(t.type === 'plot' ? [{ url: manifest[`exterior/${ext[(idx + 1) % ext.length].replace('.jpg', '')}`], caption: 'Surroundings', order: 1 }]
      : sample(interiors, 4).map((k, i) => ({ url: manifest[k], caption: ['Living room', 'Bedroom', 'Kitchen', 'Hallway'][i], order: i + 1 }))),
  ];
  const panos = Object.keys(manifest).filter((k) => k.startsWith('pano/'));
  const residential = !commercial && t.type !== 'plot';
  const featured = idx % 3 === 0;
  const drop = idx % 4 === 1 && !isRent;
  const created = new Date(Date.now() - between(1, 40) * DAY);

  return {
    title: `${pick(t.titles)}`,
    description: describe(t, locality, c, t.bhk, area),
    propertyCode: `${CODE_PREFIX}${c.code}-${String(idx + 1).padStart(2, '0')}`,
    purpose: t.purpose,
    propertyType: t.type,
    category: commercial ? 'commercial' : 'residential',
    price,
    priceNegotiable: rand() > 0.5,
    maintenanceCharges: t.type === 'apartment' ? roundTo(area * 2.5, 100) : undefined,
    area: { value: area, unit: 'sqft' },
    bedrooms: t.bhk || undefined,
    bathrooms: t.bhk ? Math.max(1, t.bhk - (rand() > 0.6 ? 1 : 0)) : commercial ? 1 : undefined,
    balconies: t.bhk >= 2 ? between(1, 3) : undefined,
    totalFloors: ['apartment', 'office'].includes(t.type) ? between(8, 28) : t.type === 'builder_floor' ? 4 : undefined,
    floorNumber: ['apartment', 'office'].includes(t.type) ? between(2, 7) : t.type === 'builder_floor' ? between(1, 3) : undefined,
    furnishing: t.type === 'plot' ? undefined : pick(isRent ? ['furnished', 'semi_furnished'] : ['semi_furnished', 'unfurnished', 'furnished']),
    ageOfProperty: t.purpose === 'new_launch' ? 0 : between(0, 8),
    constructionStatus: t.purpose === 'new_launch' ? 'new_launch' : t.type === 'plot' ? undefined : rand() > 0.8 ? 'under_construction' : 'ready_to_move',
    ownershipType: 'freehold',
    facing: pick(['north', 'east', 'north_east', 'west', 'south_east']),
    location: {
      address: `${between(12, 480)}, ${locality}, ${c.city}`,
      locality,
      city: c.city,
      state: c.state,
      pincode,
      coordinates: { type: 'Point', coordinates: jitter(center) },
    },
    amenities: sample(AMENITY_SETS[commercial ? 'commercial' : t.type === 'plot' ? 'plot' : ['apartment', 'pg'].includes(t.type) ? 'apartment' : 'house'], between(5, 9)),
    images,
    virtualTour: residential && idx % 2 === 0 ? manifest[panos[idx % panos.length]] : undefined,
    floorPlan: residential && PLAN_FOR[t.bhk] ? [{ title: `${t.bhk} BHK plan`, imageUrl: manifest[`plans/${PLAN_FOR[t.bhk]}`], description: `${area.toLocaleString('en-IN')} sq.ft` }]
      : t.type === 'office' ? [{ title: 'Office layout', imageUrl: manifest['plans/office'] }] : [],
    owner: owner._id,
    ownerType,
    preferredTenants: isRent && !commercial ? sample(['family', 'bachelor', 'company'], 2) : [],
    nearbyPlaces: sample(NEARBY, 4).map(([type, names]) => ({
      type,
      name: type === 'metro' || type === 'railway' ? `${c.city} ${pick(names)}` : pick(names),
      distance: +(0.4 + rand() * 4).toFixed(1),
      duration: between(3, 18),
    })),
    status: 'active',
    isVerified: idx % 5 !== 4,
    isFeatured: featured,
    featuredUntil: featured ? new Date(Date.now() + 365 * DAY) : undefined,
    isPremium: idx % 4 === 0,
    isHot: idx % 3 === 1,
    priceHistory: drop ? [{ price: roundTo(price * 1.07, 50000), changedAt: new Date(Date.now() - 20 * DAY) }, { price, changedAt: new Date(Date.now() - 3 * DAY) }] : [],
    views: between(40, 2400),
    uniqueViews: between(30, 1500),
    favorites: between(2, 160),
    leads: between(0, 40),
    metaKeywords: ['aadya-sample'],
    expiresAt: new Date(Date.now() + 3 * 365 * DAY),
    createdAt: created,
  };
}

const PLOTTED = {
  Kanpur: { site: 'greens', name: 'Aadya Greens', loc: 2 },
  Lucknow: { site: 'meadows', name: 'Aadya Meadows', loc: 4 },
  Ayodhya: { site: 'orchard', name: 'Aadya Orchard Enclave', loc: 1 },
  Prayagraj: { site: 'riverside', name: 'Aadya Riverside Plots', loc: 1 },
  Varanasi: { site: 'greens', name: 'Kashi Greens Township', loc: 2 },
  Noida: { site: 'meadows', name: 'Aadya Meadows Yamuna Expressway', loc: 0 },
};

const TOWERS = {
  Kanpur: 'Aadya Heights', Lucknow: 'Skyline Residency', Noida: 'Aadya Sky Gardens', Delhi: 'Skyline Dwarka Greens',
  Gurugram: 'Aadya The Crest', Mumbai: 'Skyline Bayview', Pune: 'Aadya Hillside', Bengaluru: 'Skyline Lakefront', Hyderabad: 'Aadya Cyber Towers',
};

async function seedProjects(c, users, manifest, sitesDir) {
  const out = [];
  const buyer = users.buyer;
  const plotted = PLOTTED[c.city];
  if (plotted) {
    const [locality, center, pincode] = c.localities[plotted.loc % c.localities.length];
    const site = JSON.parse(fs.readFileSync(path.join(sitesDir, `${plotted.site}.json`), 'utf8'));
    const areas = site.plots.map((p) => p.area);
    const project = await Project.create({
      name: plotted.name,
      builder: users.builder._id,
      city: c.city,
      locality,
      address: `${locality}, ${c.city} ${pincode}`,
      coordinates: { type: 'Point', coordinates: jitter(center, 0.02) },
      description: `${plotted.name} is a gated plotted development in ${locality} with 9 m internal roads, a central park, clubhouse and underground cabling. Pick your plot on the live site plan and hold it for 10 minutes while you decide.`,
      priceRange: { min: Math.min(...areas) * c.plotRate, max: Math.round(Math.max(...areas) * c.plotRate * 1.08) },
      configurations: [{ label: 'Residential plots', bedrooms: 0, minArea: Math.min(...areas), maxArea: Math.max(...areas),
        minPrice: Math.min(...areas) * c.plotRate, maxPrice: Math.round(Math.max(...areas) * c.plotRate * 1.08) }],
      images: [
        { url: manifest['exterior/plot'], isPrimary: true, order: 0, caption: 'Entrance boulevard' },
        { url: manifest[`sites/${plotted.site}`], order: 1, caption: 'Site plan' },
        { url: manifest['exterior/farmhouse'], order: 2, caption: 'Central park' },
      ],
      amenities: ['Gated entry', '24x7 security', 'Central park', 'Clubhouse', 'Jogging track', 'Underground cabling', 'Rainwater harvesting', 'Children\'s play area'],
      possessionDate: new Date(Date.now() + 240 * DAY),
      reraNumber: `UPRERAPRJ${between(100000, 999999)}`,
      totalUnits: site.plots.length,
      status: 'under_construction',
      isFeatured: true,
      isVerified: true,
      views: between(300, 4000),
      searches: between(100, 900),
    });
    const layout = await Layout.create({
      projectId: project._id,
      title: `${plotted.name} · Phase 1`,
      backgroundImageUrl: manifest[`sites/${plotted.site}`],
      imageWidth: site.width,
      imageHeight: site.height,
    });
    let available = 0;
    const plots = site.plots.map((p, i) => {
      const r = rand();
      const status = r < 0.24 ? 'booked' : r < 0.32 ? 'locked' : 'available';
      if (status === 'available') available++;
      return {
        layoutId: layout._id,
        plotNumber: p.plotNumber,
        coordinates: p.coordinates,
        area: p.area,
        price: roundTo(p.area * c.plotRate * (p.corner ? 1.08 : 1) * (1 + (i % 5) * 0.01), 10000),
        status,
        bookedBy: status === 'booked' ? buyer._id : null,
        lockedBy: status === 'locked' ? buyer._id : null,
        lockedUntil: status === 'locked' ? new Date(Date.now() + 2 * DAY) : null,
      };
    });
    await Plot.insertMany(plots);
    project.availableUnits = available;
    await project.save();
    out.push({ project, plots: plots.length });
  }

  const tower = TOWERS[c.city];
  if (tower) {
    const [locality, center, pincode] = c.localities[1 % c.localities.length];
    const builder = c.city.length % 2 ? users.builder : users.builder2;
    const configs = [[2, 1050, 1250], [3, 1450, 1750], [4, 2100, 2500]].map(([b, a1, a2]) => ({
      label: `${b} BHK`, bedrooms: b, minArea: a1, maxArea: a2, minPrice: roundTo(a1 * c.rate, 100000), maxPrice: roundTo(a2 * c.rate * 1.1, 100000),
    }));
    const project = await Project.create({
      name: tower,
      builder: builder._id,
      city: c.city,
      locality,
      address: `${locality}, ${c.city} ${pincode}`,
      coordinates: { type: 'Point', coordinates: jitter(center, 0.02) },
      description: `${tower} brings ${between(3, 6)} towers of 2, 3 and 4 BHK homes to ${locality}, set around a 2-acre landscaped deck with a 25 m pool, double-height clubhouse and sky lounge. Every home gets cross ventilation and a sun-deck balcony.`,
      priceRange: { min: configs[0].minPrice, max: configs[2].maxPrice },
      configurations: configs,
      images: [
        { url: manifest['exterior/project'], isPrimary: true, order: 0, caption: 'Tower elevation' },
        { url: manifest['exterior/apartment'], order: 1, caption: 'Facade' },
        ...sample(Object.keys(manifest).filter((k) => k.startsWith('interior/')), 3).map((k, i) => ({ url: manifest[k], order: i + 2, caption: 'Sample flat' })),
        { url: manifest['plans/3bhk'], order: 6, caption: '3 BHK floor plan' },
      ],
      amenities: ['Swimming pool', 'Gym', 'Clubhouse', 'Kids play area', 'Jogging track', 'Power backup', 'EV charging', 'Sky lounge', 'Co-working', '24x7 security'],
      possessionDate: new Date(Date.now() + between(180, 900) * DAY),
      reraNumber: `RERA-${c.code}-${between(10000, 99999)}`,
      totalUnits: between(240, 720),
      availableUnits: between(30, 180),
      status: rand() > 0.5 ? 'under_construction' : 'ready_to_move',
      isFeatured: true,
      isVerified: true,
      views: between(500, 6000),
      searches: between(100, 1500),
    });
    out.push({ project, builder });
  }
  return out;
}

async function seed(assetsDir, exteriorsDir) {
  const manifest = await uploadAll(assetsDir, exteriorsDir);
  await removeSamples({ media: false });
  const users = await createUsers();
  const videos = Object.keys(manifest).filter((k) => k.startsWith('videos/'));
  const owners = [[users.owner, 'individual'], [users.dealer, 'dealer'], [users.owner2, 'individual'], [users.builder, 'builder']];
  let propertyCount = 0;
  let projectCount = 0;
  let plotCount = 0;
  let shortCount = 0;

  for (const [ci, c] of CITIES.entries()) {
    const projects = await seedProjects(c, users, manifest, path.join(assetsDir, 'sites'));
    projectCount += projects.length;
    plotCount += projects.reduce((s, p) => s + (p.plots || 0), 0);
    const tower = projects.find((p) => p.builder);

    const templates = Array.from({ length: 7 }, (_, k) => TEMPLATES[(ci * 2 + k) % TEMPLATES.length]);
    const created = [];
    for (const [k, t] of templates.entries()) {
      const [owner, ownerType] = owners[(ci + k) % owners.length];
      const doc = buildProperty(t, c, ci + k, owner, ownerType, manifest, k);
      // Builder-posted apartments belong to the city's tower project.
      if (tower && t.type === 'apartment' && t.purpose !== 'rent') {
        doc.owner = tower.builder._id;
        doc.ownerType = 'builder';
        doc.project = tower.project._id;
        doc.location.locality = tower.project.locality;
      }
      const property = new Property(doc);
      await property.save();
      created.push(property);
    }
    propertyCount += created.length;

    // Two walkthrough shorts per city, attached to its homes.
    const homes = created.filter((p) => !['plot', 'office', 'shop'].includes(p.propertyType));
    for (let s = 0; s < Math.min(2, homes.length); s++) {
      const home = homes[s];
      const videoUrl = manifest[videos[(ci * 2 + s) % videos.length]];
      const bhk = home.bedrooms ? `${home.bedrooms} BHK ` : '';
      await Short.create({
        property: home._id,
        owner: home.owner,
        videoUrl,
        thumbnail: videoThumb(videoUrl),
        caption: `${bhk}${home.propertyType.replace(/_/g, ' ')} walkthrough in ${home.location.locality}, ${c.city} 🏡`,
        city: c.city,
        locality: home.location.locality,
        views: between(120, 9000),
        shares: between(0, 120),
        status: 'active',
        createdAt: new Date(Date.now() - between(0, 20) * DAY),
      });
      home.videos = [{ url: videoUrl, thumbnail: videoThumb(videoUrl), caption: 'Walkthrough', duration: 12 }];
      await home.save();
      shortCount++;
    }
    console.log(`  ${c.city}: ${created.length} listings, ${projects.length} projects`);
  }
  console.log(`Seeded ${propertyCount} properties, ${projectCount} projects (${plotCount} plots), ${shortCount} shorts.`);
}

// Plot locks used to carry a TTL index, which made MongoDB delete the whole
// plot document once a hold expired. Drop it if an older deployment created it.
async function dropPlotTtlIndex() {
  const indexes = await Plot.collection.indexes().catch(() => []);
  for (const ix of indexes) {
    if (ix.key && ix.key.lockedUntil && ix.expireAfterSeconds !== undefined) {
      await Plot.collection.dropIndex(ix.name);
      console.log(`Dropped TTL index ${ix.name} on plots (it deleted plots when a hold expired)`);
    }
  }
}

// Builds every sample document against a fake media manifest and validates
// it with the Mongoose schemas, without connecting to the database.
function dryRun(assets) {
  const manifest = {};
  for (const g of ['pano', 'interior', 'plans', 'sites', 'videos']) {
    for (const f of fs.readdirSync(path.join(assets, g))) manifest[`${g}/${f.replace(/\.\w+$/, '')}`] = `https://example.test/${g}/${f}`;
  }
  for (const f of new Set(Object.values(EXTERIOR).flat())) manifest[`exterior/${f.replace('.jpg', '')}`] = `https://example.test/${f}`;
  const fakeUser = { _id: new mongoose.Types.ObjectId() };
  const errors = [];
  let n = 0;
  for (const [ci, c] of CITIES.entries()) {
    for (let k = 0; k < 7; k++) {
      const t = TEMPLATES[(ci * 2 + k) % TEMPLATES.length];
      const err = new Property(buildProperty(t, c, ci + k, fakeUser, 'individual', manifest, k)).validateSync();
      if (err) errors.push(`${c.city} ${t.type}: ${err.message}`);
      n++;
    }
  }
  for (const key of new Set(Object.values(PLOTTED).map((p) => p.site))) {
    const site = JSON.parse(fs.readFileSync(path.join(assets, 'sites', `${key}.json`), 'utf8'));
    for (const p of site.plots) {
      const err = new Plot({ layoutId: fakeUser._id, plotNumber: p.plotNumber, coordinates: p.coordinates, area: p.area, price: 1 }).validateSync();
      if (err) errors.push(`${key} ${p.plotNumber}: ${err.message}`);
    }
  }
  console.log(`Validated ${n} properties; ${errors.length} errors`);
  errors.slice(0, 10).forEach((e) => console.log('  ' + e));
  if (errors.length) process.exitCode = 1;
}

(async () => {
  if (args['dry-run']) {
    dryRun(path.resolve(args.assets || path.join(__dirname, '../../sample-assets')));
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4, autoIndex: false });
    if (args.remove) {
      await removeSamples({ media: true });
    } else {
      const assets = args.assets || process.env.SAMPLE_ASSETS || path.join(__dirname, '../../sample-assets');
      if (!fs.existsSync(path.join(assets, 'sites'))) throw new Error(`No sample media in ${assets}; pass --assets=<dir>`);
      await dropPlotTtlIndex();
      await seed(path.resolve(assets), path.resolve(args.exteriors || path.join(__dirname, '../../aadya_acres/assets/images')));
    }
  } catch (e) {
    console.error('Sample seeding failed:', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
