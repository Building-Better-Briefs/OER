import { useCallback, useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BuildingBetterBriefsReadMoreSheet } from '@/components/building-better-briefs-read-more-sheet';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    duplicateBrief,
    ensureSampleBriefs,
    exportAllBriefs,
    importBriefsFromFile,
    listBriefs,
    requestPersistentStorage,
    softDeleteBrief,
    type LocalBriefRecord
} from '@/lib/brief-store';
import { isSampleBriefId } from '@/lib/sample-brief-ids';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function DashboardPage() {
    const [briefs, setBriefs] = useState<LocalBriefRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteDialogBrief, setDeleteDialogBrief] =
        useState<LocalBriefRecord | null>(null);
    const [aboutOpen, setAboutOpen] = useState(false);

    const refresh = useCallback(async () => {
        await ensureSampleBriefs();
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

    const handleConfirmDelete = async () => {
        if (!deleteDialogBrief) return;
        await softDeleteBrief(deleteDialogBrief.id);
        setDeleteDialogBrief(null);
        await refresh();
        toast.success('Brief deleted');
    };

    return (
        <div className='dashboard-page flex flex-1 flex-col px-4 py-8 sm:px-6'>
            <header className='mx-auto mb-8 w-full max-w-[80rem]'>
                <div className='mb-4'>
                    <Button
                        variant='ghost'
                        size='sm'
                        type='button'
                        onClick={() => setAboutOpen(true)}>
                        <Info className='size-4' aria-hidden />
                        About this project
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
                        {briefs.map((b) => {
                            const sampleBrief = isSampleBriefId(b.id);
                            return (
                            <li
                                key={b.id}
                                className='flex flex-wrap items-center justify-between gap-4 px-4 py-4'>
                                <div>
                                    <p className='font-medium'>
                                        {b.metadata.title}
                                        {sampleBrief ? (
                                            <span className='ml-2 text-xs font-normal text-muted-foreground'>
                                                Sample
                                            </span>
                                        ) : null}
                                    </p>
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
                                        variant='outline'
                                        size='sm'
                                        disabled={sampleBrief}
                                        title={
                                            sampleBrief
                                                ? 'Sample briefs stay on your dashboard so you can explore the builder'
                                                : undefined
                                        }
                                        aria-label={
                                            sampleBrief
                                                ? 'Delete unavailable for sample briefs'
                                                : `Delete ${b.metadata.title}`
                                        }
                                        className='border-transparent text-destructive hover:border-destructive hover:bg-destructive hover:text-white disabled:pointer-events-auto disabled:opacity-50'
                                        onClick={() => {
                                            if (!sampleBrief) {
                                                setDeleteDialogBrief(b);
                                            }
                                        }}>
                                        Delete
                                    </Button>
                                </div>
                            </li>
                            );
                        })}
                    </ul>
                )}
            </main>

            <Dialog
                open={deleteDialogBrief !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteDialogBrief(null);
                }}>
                <DialogContent className='rounded-none sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Delete this brief?</DialogTitle>
                        <DialogDescription>
                            {deleteDialogBrief
                                ? `“${deleteDialogBrief.metadata.title}” will be removed from this browser. You can restore it from a backup if needed.`
                                : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            className='font-light rounded-none'
                            onClick={() => setDeleteDialogBrief(null)}>
                            Cancel
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            className='font-light rounded-none'
                            onClick={() => void handleConfirmDelete()}>
                            Delete brief
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BuildingBetterBriefsReadMoreSheet
                open={aboutOpen}
                onOpenChange={setAboutOpen}
            />
        </div>
    );
}
