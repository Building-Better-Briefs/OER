import { Outlet } from 'react-router-dom';
import { OfflineSiteFooter } from '@/components/offline-site-footer';

export function OfflineAppLayout() {
    return (
        <div className='flex min-h-dvh flex-col bg-background'>
            <div className='flex min-h-0 flex-1 flex-col'>
                <Outlet />
            </div>
            <OfflineSiteFooter />
        </div>
    );
}
