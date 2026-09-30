export const OFFLINE_ROUTES = {
    home: '/',
    dashboard: '/dashboard',
    create: '/create',
    briefEdit: (id: string) => `/briefs/${id}/edit`,
    briefBuilder: (id: string) => `/briefs/${id}/builder`
} as const;

export const BUILDING_BETTER_BRIEFS_PDF_URL = `${import.meta.env.BASE_URL}BuildingBetterBriefs.pdf`;

export const BUILDING_BETTER_BRIEFS_PDF_FILENAME = 'BuildingBetterBriefs.pdf';
