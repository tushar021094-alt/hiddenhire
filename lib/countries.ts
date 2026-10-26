export const COUNTRY_OPTIONS = [
  "Afghanistan", "Åland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla",
  "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan",
  "Bolivia", "Bonaire, Sint Eustatius and Saba", "Bosnia and Herzegovina", "Botswana", "Bouvet Island", "Brazil",
  "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde",
  "Cambodia", "Cameroon", "Canada", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China",
  "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Congo, Democratic Republic of the",
  "Cook Islands", "Costa Rica", "Côte d’Ivoire", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czechia", "Denmark",
  "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea",
  "Estonia", "Eswatini", "Ethiopia", "Falkland Islands (Malvinas)", "Faroe Islands", "Fiji", "Finland", "France",
  "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany",
  "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Heard Island and McDonald Islands", "Holy See", "Honduras", "Hong Kong",
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Isle of Man", "Israel", "Italy",
  "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South",
  "Kuwait", "Kyrgyzstan", "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
  "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue",
  "Norfolk Island", "North Macedonia", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau",
  "Palestine, State of", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn", "Poland",
  "Portugal", "Puerto Rico", "Qatar", "Réunion", "Romania", "Russian Federation", "Rwanda", "Saint Barthélemy",
  "Saint Helena, Ascension and Tristan da Cunha", "Saint Kitts and Nevis", "Saint Lucia", "Saint Martin (French part)",
  "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Sint Maarten (Dutch part)",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and the South Sandwich Islands",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden", "Switzerland",
  "Syrian Arab Republic", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tokelau", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda",
  "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "United States Minor Outlying Islands",
  "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Viet Nam", "Virgin Islands, British", "Virgin Islands, U.S.",
  "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe",
] as const;

const COUNTRY_KEYS = new Set(COUNTRY_OPTIONS.map(normalizeCountryKey));

const COUNTRY_ALIASES: Record<string, string> = {
  in: "India",
  us: "United States",
  usa: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  gb: "United Kingdom",
  uae: "United Arab Emirates",
  "south korea": "Korea, South",
  "north korea": "Korea, North",
  "russia": "Russian Federation",
  "czech republic": "Czechia",
  "ivory coast": "Côte d’Ivoire",
  "turkey": "Türkiye",
  "vietnam": "Viet Nam",
  "iran, islamic republic of": "Iran",
  "laos": "Lao People's Democratic Republic",
  "moldova, republic of": "Moldova",
  "bolivia, plurinational state of": "Bolivia",
  "venezuela, bolivarian republic of": "Venezuela",
};

function normalizeCountryKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function canonicalCountryName(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const alias = COUNTRY_ALIASES[normalized.toLocaleLowerCase()];
  if (alias) return alias;
  return COUNTRY_KEYS.has(normalizeCountryKey(normalized))
    ? COUNTRY_OPTIONS.find((country) => normalizeCountryKey(country) === normalizeCountryKey(normalized)) ?? null
    : null;
}

export function isCountryName(value: string): boolean {
  return canonicalCountryName(value) !== null;
}

export const LOCATION_SUGGESTIONS: Record<string, readonly string[]> = {
  India: ["Delhi NCR", "Noida", "Greater Noida", "Gurugram", "Lucknow", "Bengaluru", "Hyderabad", "Mumbai", "Pune", "Chennai", "Jaipur", "Kolkata"],
  "United States": ["New York", "San Francisco", "Austin", "Seattle", "Boston", "Chicago", "Los Angeles", "Washington, DC"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds"],
  Canada: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Canberra"],
  Singapore: ["Singapore"],
  Germany: ["Berlin", "Munich", "Frankfurt", "Hamburg"],
  France: ["Paris", "Lyon", "Toulouse", "Marseille"],
  Netherlands: ["Amsterdam", "Rotterdam", "Utrecht"],
  Japan: ["Tokyo", "Osaka", "Yokohama"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam"],
  Ireland: ["Dublin", "Cork", "Galway"],
  "New Zealand": ["Auckland", "Wellington", "Christchurch"],
};
