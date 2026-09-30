import { Outlet } from 'react-router-dom';
import { OfflineSiteFooter } from '@/components/offline-site-footer';

export function OfflineAppLayout() {
    return (
        <div className='flex h-dvh flex-col overflow-hidden bg-background'>
            <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
                <Outlet />
            </div>
            <OfflineSiteFooter />
        </div>
    );
}
