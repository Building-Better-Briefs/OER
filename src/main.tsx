import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PwaLauncherRedirect } from '@/components/pwa-launcher-redirect';
import { Toaster } from '@/components/ui/sonner';
import { OfflineAppLayout } from '@/components/offline-app-layout';
import './offline.css';
import '@/lib/pwa-install-client';
import { HomePage } from '@/routes/home-page';
import { DashboardPage } from '@/routes/dashboard-page';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';

const DetailsPage = lazy(() =>
    import('@/routes/brief-details-page').then((m) => ({
        default: m.BriefDetailsPage
    }))
);
const BuilderPage = lazy(() =>
    import('@/routes/brief-builder-page').then((m) => ({
        default: m.BriefBuilderPage
    }))
);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <HashRouter>
            <PwaLauncherRedirect />
            <Suspense fallback={<div className='p-8'>Loading…</div>}>
                <Routes>
                    <Route element={<OfflineAppLayout />}>
                        <Route path={OFFLINE_ROUTES.home} element={<HomePage />} />
                        <Route
                            path={OFFLINE_ROUTES.dashboard}
                            element={<DashboardPage />}
                        />
                        <Route
                            path={OFFLINE_ROUTES.create}
                            element={<DetailsPage mode='create' />}
                        />
                        <Route
                            path='/briefs/:id/edit'
                            element={<DetailsPage mode='edit' />}
                        />
                        <Route
                            path='/briefs/:id/builder'
                            element={<BuilderPage />}
                        />
                    </Route>
                    <Route
                        path='*'
                        element={
                            <Navigate to={OFFLINE_ROUTES.home} replace />
                        }
                    />
                </Routes>
            </Suspense>
            <Toaster />
        </HashRouter>
    </StrictMode>
);
