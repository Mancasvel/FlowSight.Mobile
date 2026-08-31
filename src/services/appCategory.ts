/**
 * Map Screen Time apps to Apple-style categories so Insights can show
 * a short top-5 list instead of a clipped app roster.
 */

const BUNDLE_CATEGORY: Record<string, string> = {
  'com.burbn.instagram': 'Social',
  'net.whatsapp.whatsapp': 'Social',
  'com.atebits.tweetie2': 'Social',
  'com.zhiliaoapp.musically': 'Social',
  'com.facebook.facebook': 'Social',
  'com.facebook.messenger': 'Social',
  'com.toyopagroup.picaboo': 'Social',
  'ph.telegra.telegraph': 'Social',
  'com.hammerandchisel.discord': 'Social',
  'com.linkedin.linkedin': 'Social',
  'com.google.ios.youtube': 'Entertainment',
  'com.netflix.netflix': 'Entertainment',
  'com.spotify.client': 'Entertainment',
  'com.apple.tv': 'Entertainment',
  'com.amazon.aiv.aivapp': 'Entertainment',
  'tv.twitch': 'Entertainment',
  'com.apple.mobilemail': 'Productivity',
  'com.apple.mobilecal': 'Productivity',
  'com.apple.mobilenotes': 'Productivity',
  'com.apple.reminders': 'Productivity',
  'com.apple.dt.xcode': 'Productivity',
  'com.microsoft.office.outlook': 'Productivity',
  'com.tinyspeck.chatlyio': 'Productivity',
  'com.microsoft.teams': 'Productivity',
  'com.apple.mobilesafari': 'Reading',
  'com.google.chrome.ios': 'Reading',
  'com.apple.news': 'Reading',
  'com.figma.figma': 'Creativity',
  'com.adobe.psmobile': 'Creativity',
};

const NAME_CATEGORY: Record<string, string> = {
  instagram: 'Social',
  whatsapp: 'Social',
  telegram: 'Social',
  snapchat: 'Social',
  tiktok: 'Social',
  twitter: 'Social',
  x: 'Social',
  facebook: 'Social',
  messenger: 'Social',
  discord: 'Social',
  linkedin: 'Social',
  messages: 'Social',
  slack: 'Productivity',
  teams: 'Productivity',
  mail: 'Productivity',
  calendar: 'Productivity',
  notes: 'Productivity',
  reminders: 'Productivity',
  notion: 'Productivity',
  xcode: 'Productivity',
  outlook: 'Productivity',
  youtube: 'Entertainment',
  netflix: 'Entertainment',
  spotify: 'Entertainment',
  twitch: 'Entertainment',
  safari: 'Reading',
  chrome: 'Reading',
  news: 'Reading',
  reddit: 'Reading',
  figma: 'Creativity',
  photos: 'Creativity',
  camera: 'Creativity',
  maps: 'Travel',
  weather: 'Utilities',
  settings: 'Utilities',
  files: 'Utilities',
  'app store': 'Utilities',
  'focus app': 'Productivity',
  'other app': 'Other',
};

const NAME_HINTS: Array<[RegExp, string]> = [
  [/instagram|whatsapp|telegram|snapchat|tiktok|twitter|facebook|messenger|discord|linkedin|imessage/, 'Social'],
  [/youtube|netflix|spotify|twitch|disney|prime video|apple tv|podcast/, 'Entertainment'],
  [/mail|calendar|notes|reminder|notion|xcode|outlook|slack|teams|zoom|docs|excel|word/, 'Productivity'],
  [/figma|photoshop|procreate|garageband|imovie|canva|photos|camera/, 'Creativity'],
  [/safari|chrome|firefox|news|reddit|kindle|wikipedia|reader/, 'Reading'],
  [/strava|fitness|health|workout/, 'Health'],
  [/amazon|ebay|shop/, 'Shopping'],
  [/maps|uber|lyft|airline/, 'Travel'],
  [/game|games/, 'Games'],
];

export function screenTimeCategory(name: string, bundleId?: string | null): string {
  const bundle = bundleId?.trim().toLowerCase() ?? '';
  if (bundle && BUNDLE_CATEGORY[bundle]) return BUNDLE_CATEGORY[bundle];

  const key = name.trim().toLowerCase();
  if (!key) return 'Other';
  if (NAME_CATEGORY[key]) return NAME_CATEGORY[key];

  for (const [pattern, category] of NAME_HINTS) {
    if (pattern.test(key) || (bundle && pattern.test(bundle))) return category;
  }

  return 'Other';
}
