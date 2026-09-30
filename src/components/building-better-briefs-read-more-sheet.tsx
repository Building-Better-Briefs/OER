import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle
} from '@/components/ui/sheet';
import { BuildingBetterBriefsSections } from '@/components/building-better-briefs-sections';
import { blocksForReadMore } from '@/content/building-better-briefs';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function BuildingBetterBriefsReadMoreSheet({
    open,
    onOpenChange
}: Props) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side='right'
                className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl'>
                <SheetHeader className='shrink-0 border-b px-6 py-5 text-left'>
                    <SheetTitle>Building Better Briefs</SheetTitle>
                    <SheetDescription className='sr-only'>
                        Full project overview, design principles, and references
                    </SheetDescription>
                </SheetHeader>
                <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6'>
                    {open ? (
                        <BuildingBetterBriefsSections
                            blocks={blocksForReadMore()}
                        />
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
}
