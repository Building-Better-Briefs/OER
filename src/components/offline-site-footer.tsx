const CC_BY_NC_SA =
    'https://creativecommons.org/licenses/by-nc-sa/4.0/';
const GPL_3 = 'https://www.gnu.org/licenses/gpl-3.0.html';

export function OfflineSiteFooter() {
    return (
        <footer className='shrink-0 border-t bg-background px-4 py-6 sm:px-6 print:hidden'>
            <p className='mx-auto max-w-[80rem] text-center text-xs font-light leading-relaxed text-muted-foreground'>
                Educational content licensed under{' '}
                <a
                    href={CC_BY_NC_SA}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='underline underline-offset-2 hover:text-foreground'>
                    CC BY-NC-SA 4.0
                </a>
                . Software licensed under{' '}
                <a
                    href={GPL_3}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='underline underline-offset-2 hover:text-foreground'>
                    GPL-3.0
                </a>
                . ©️ 2026 Stefan Paz Berrios and Mohammed Cherbatji.
            </p>
        </footer>
    );
}
