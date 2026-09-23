// Rail and panel icons, one 24x24 stroke path each. Same style as the existing
// Sidebar icons: stroke 1.9, round caps and joins, currentColor.
// Render: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={NAV_ICON[key]} /></svg>

export const NAV_ICON = {
  'home': 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  'my-work': 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  'report': 'M21 12a9 9 0 1 1-9-9v9zM21 12h-9V3a9 9 0 0 1 9 9z',
  'my-team': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'my-hours': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 12V7M12 12h4',
  'chat': 'M21 11.5a8.4 8.4 0 0 1-9 8.3 9 9 0 0 1-3.6-.7L3 21l1.9-4.6A8.4 8.4 0 1 1 21 11.5z',
  'emails': 'M3 6h18v12H3zM3 7l9 6 9-6',
  'tools': 'M3 8h18v12H3zM8 8V5h8v3M3 13h18M10 13v3h4v-3',
  'people': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'schema-app': 'M8 4H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1M10 12h4',
  'schema-scraper': 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 11v7M9 15l3 3 3-3',
  'knowledge-graph': 'M7 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM21 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 6h10M6 8l5 8M18 8l-5 8',
  'page-auditor': 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2H9zM9 14l2 2 4-4',
  'image-optimization': 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M17 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
  'analytics': 'M3 3v18h18M7 15l4-4 3 3 5-6',
  'impact-globe': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  'href-links': 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  'publishing-goals': 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  'boards': 'M3 3h18v18H3zM9 3v18M15 3v18',
  'client-reports': 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 11v8M14 13h-3a1 1 0 0 0 0 2h2a1 1 0 0 1 0 2h-3',
  'directory': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'organization': 'M9 3h6v5H9zM3 16h5v5H3zM9.5 16h5v5h-5zM16 16h5v5h-5zM12 8v4M5.5 16v-4h13v4M12 12v4',
  'human-resources': 'M18 8A6 6 0 1 1 6 8a6 6 0 0 1 12 0zM15.5 12.9 17 22l-5-3-5 3 1.5-9.1',
  'tickets': 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM10 6v12',
  'settings': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  'launcher': 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-3.5-3.5',
  'admin': 'M12 22s8-3 8-9V6l-8-3-8 3v7c0 6 8 9 8 9zM9 12l2 2 4-4',
  'view-stage': 'M3 5h18v14H3zM9 5v14M15 5v14',
  'monday-accounts': 'M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5',
  'automations': 'M13 2 4 14h7l-1 8 9-12h-7z',
  'tests': 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2H9zM9 14l2 2 4-4',
  'manual': 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  'clocky': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2M3.5 9.5h2M18.5 9.5h2',
  'bell': 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  'messages': 'M21 11.5a8.4 8.4 0 0 1-9 8.3 9 9 0 0 1-3.6-.7L3 21l1.9-4.6A8.4 8.4 0 1 1 21 11.5zM8 11h8M8 14h5',
} as const

export type NavIconKey = keyof typeof NAV_ICON
