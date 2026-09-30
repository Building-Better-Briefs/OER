import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    duplicateBrief,
    exportAllBriefs,
    importBriefsFromFile,
    listBriefs,
    requestPersistentStorage,
    softDeleteBrief,
    type LocalBriefRecord
} from '@/lib/brief-store';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function DashboardPage() {
    const [briefs, setBriefs] = useState<LocalBriefRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setBriefs(await listBriefs());
    }, []);

    useEffect(() => {
        void refresh().finally(() => setLoading(false));
    }, [refresh]);

    const handleExportAll = async () => {
        const blob = await exportAllBriefs();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `briefs-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Backup downloaded');
    };

    const handleImport = async (file: File) => {
        try {
            const n = await importBriefsFromFile(file);
            await refresh();
            toast.success(`Imported ${n} brief(s)`);
        } catch {
            toast.error('Import failed');
        }
    };

    return (
        <div className='dashboard-page flex flex-1 flex-col px-4 py-8 sm:px-6'>
            <header className='mx-auto mb-8 w-full max-w-[80rem]'>
                <div className='mb-4'>
                    <Button variant='ghost' size='sm' asChild>
                        <Link to={OFFLINE_ROUTES.home}>
                            About this project
                        </Link>
                    </Button>
                </div>
                <h1 className='text-2xl font-extralight tracking-tight sm:text-3xl'>
                    Assessment Brief Builder
                </h1>
                <p className='mt-2 text-sm font-light text-muted-foreground'>
                    Offline — briefs are stored in this browser. Export a backup
                    regularly.
                </p>
                <div className='mt-4 flex flex-wrap gap-2'>
                    <Button asChild>
                        <Link
                            to={OFFLINE_ROUTES.create}
                            onClick={() => void requestPersistentStorage()}>
                            Create brief
                        </Link>
                    </Button>
                    <Button variant='outline' onClick={() => void handleExportAll()}>
                        Export all briefs
                    </Button>
                    <Button variant='outline' asChild>
                        <label className='cursor-pointer'>
                            Import
                            <input
                                type='file'
                                accept='application/json,.json'
                                className='hidden'
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleImport(f);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    </Button>
                </div>
            </header>

            <main className='mx-auto w-full max-w-[80rem]'>
                {loading ? (
                    <p className='text-muted-foreground'>Loading…</p>
                ) : briefs.length === 0 ? (
                    <p className='text-muted-foreground'>
                        No briefs yet. Create your first assignment brief.
                    </p>
                ) : (
                    <ul className='divide-y border'>
                        {briefs.map((b) => (
                            <li
                                key={b.id}
                                className='flex flex-wrap items-center justify-between gap-4 px-4 py-4'>
                                <div>
                                    <p className='font-medium'>{b.metadata.title}</p>
                                    <p className='text-sm text-muted-foreground'>
                                        {b.metadata.module}
                                    </p>
                                    <p className='text-xs text-muted-foreground'>
                                        Updated{' '}
                                        {format(
                                            new Date(b.updatedAt),
                                            'd MMM yyyy HH:mm'
                                        )}
                                    </p>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                    <Button variant='outline' size='sm' asChild>
                                        <Link
                                            to={OFFLINE_ROUTES.briefBuilder(
                                                b.id
                                            )}>
                                            Edit
                                        </Link>
                                    </Button>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={async () => {
                                            const copy = await duplicateBrief(b);
                                            await refresh();
                                            toast.success('Duplicated');
                                            window.location.hash = `#${OFFLINE_ROUTES.briefBuilder(copy.id)}`;
                                        }}>
                                        Duplicate
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={async () => {
                                            if (
                                                confirm(
                                                    'Delete this brief? You can restore from backup if needed.'
                                                )
                                            ) {
                                                await softDeleteBrief(b.id);
                                                await refresh();
                                            }
                                        }}>
                                        Delete
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}
