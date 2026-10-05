export type LocationCluster = 'delhi-ncr' | 'bengaluru' | 'mumbai' | 'hyderabad' | 'pune' | 'chennai' | 'other';

const LOCATION_ALIASES: Record<string, string> = {
  noida: 'noida',
  'noida, uttar pradesh': 'noida',
  'noida, up': 'noida',
  'greater noida': 'greater noida',
  'greater noida, uttar pradesh': 'greater noida',
  delhi: 'delhi',
  'new delhi': 'delhi',
  'delhi, india': 'delhi',
  'delhi ncr': 'delhi ncr',
  gurugram: 'gurugram',
  gurgaon: 'gurugram',
  'gurugram, haryana': 'gurugram',
  'gurgaon, haryana': 'gurugram',
  faridabad: 'faridabad',
  ghaziabad: 'ghaziabad',
  bengaluru: 'bengaluru',
  bangalore: 'bengaluru',
  'bengaluru, india': 'bengaluru',
  'bangalore, india': 'bengaluru',
  mumbai: 'mumbai',
  'mumbai, india': 'mumbai',
  hyderabad: 'hyderabad',
  'hyderabad, india': 'hyderabad',
  pune: 'pune',
  'pune, india': 'pune',
  chennai: 'chennai',
  'chennai, india': 'chennai',
};

const DELHI_NCR_CITIES = new Set(['delhi', 'delhi ncr', 'noida', 'greater noida', 'gurugram', 'faridabad', 'ghaziabad']);

export function normalizeLocation(value: string): string {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  return LOCATION_ALIASES[normalized] || normalized;
}

export function getLocationCluster(value: string): LocationCluster {
  const normalized = normalizeLocation(value);
  if (DELHI_NCR_CITIES.has(normalized) || /delhi\s*ncr|noida|greater noida|gurugram|gurgaon|faridabad|ghaziabad/i.test(normalized)) return 'delhi-ncr';
  if (/bengaluru|bangalore/i.test(normalized)) return 'bengaluru';
  if (/mumbai/i.test(normalized)) return 'mumbai';
  if (/hyderabad/i.test(normalized)) return 'hyderabad';
  if (/pune/i.test(normalized)) return 'pune';
  if (/chennai/i.test(normalized)) return 'chennai';
  return 'other';
}

export function isLocationMatch(preferred: string, jobLocation: string): boolean {
  const preferredNormalized = normalizeLocation(preferred);
  const jobNormalized = normalizeLocation(jobLocation);

  if (
    preferredNormalized === jobNormalized ||
    jobNormalized.includes(preferredNormalized) ||
    preferredNormalized.includes(jobNormalized)
  ) return true;

  const preferredCluster = getLocationCluster(preferredNormalized);
  const jobCluster = getLocationCluster(jobNormalized);

  return preferredCluster !== 'other' && preferredCluster === jobCluster;
}

export function isIndiaLocation(value: string): boolean {
  return /india|delhi|noida|greater noida|gurugram|gurgaon|faridabad|ghaziabad|bengaluru|bangalore|mumbai|hyderabad|pune|chennai/i.test(value);
}
