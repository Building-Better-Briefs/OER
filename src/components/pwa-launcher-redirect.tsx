import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';

/** Opens dashboard when the PWA launches via manifest `start_url`. */
export function PwaLauncherRedirect() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('launcher') !== 'pwa') {
            return;
        }
        const path = location.pathname;
        if (
            path === OFFLINE_ROUTES.dashboard ||
            path.startsWith('/briefs') ||
            path === OFFLINE_ROUTES.create
        ) {
            return;
        }
        navigate(OFFLINE_ROUTES.dashboard, { replace: true });
    }, [location.pathname, navigate]);

    return null;
}
