export const appCategories = [
  'All',
  'Creator',
  'Communication',
  'Analytics',
] as const;
export type AppCategory = (typeof appCategories)[number];
export type DemoApp = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  added: boolean;
  capabilities: string[];
};
// UI fixtures only: these are not verified provider contracts or authorizations.
export const demoApps: DemoApp[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email & business communication',
    categories: ['Communication'],
    added: true,
    capabilities: ['Email search', 'Draft emails', 'Email follow-up'],
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Ideas, scripts & project tracking',
    categories: ['Creator', 'Productivity'],
    added: true,
    capabilities: ['Create pages', 'Manage project notes', 'Track tasks'],
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Files, footage & creative assets',
    categories: ['Creator', 'Productivity'],
    added: true,
    capabilities: ['Search files', 'Organize assets', 'Access documents'],
  },
  {
    id: 'wideframe',
    name: 'Wideframe',
    description: 'AI media search & organization',
    categories: ['Creator'],
    added: false,
    capabilities: [
      'Search media',
      'Organize footage',
      'Prepare media selections',
    ],
  },
  {
    id: 'frameio',
    name: 'Frame.io',
    description: 'Review, versions & feedback',
    categories: ['Creator'],
    added: false,
    capabilities: ['Review videos', 'Track versions', 'Manage feedback'],
  },
  {
    id: 'youtube',
    name: 'YouTube Studio',
    description: 'Publishing performance & analytics',
    categories: ['Creator', 'Analytics'],
    added: false,
    capabilities: ['Read video metrics', 'Review channel performance'],
  },
  {
    id: 'metricool',
    name: 'Metricool',
    description: 'Cross-platform scheduling & analytics',
    categories: ['Creator', 'Analytics'],
    added: false,
    capabilities: ['Review analytics', 'Manage publishing schedules'],
  },
];
export function filterDemoApps(
  apps: DemoApp[],
  query: string,
  category: AppCategory,
) {
  const search = query.trim().toLowerCase();
  return apps.filter(
    app =>
      (category === 'All' || app.categories.includes(category)) &&
      `${app.name} ${app.description}`.toLowerCase().includes(search),
  );
}
