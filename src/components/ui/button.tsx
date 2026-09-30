import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none border-none focus:outline-2 focus:outline-brand focus:outline-offset-2 active:scale-[0.99]",
    {
        variants: {
            variant: {
                default:
                    'bg-brand text-brand-foreground hover:bg-brand-hover hover:-translate-y-0.5',
                destructive:
                    'bg-destructive text-white hover:bg-destructive/90 hover:-translate-y-0.5 dark:bg-destructive/60',
                outline:
                    'border-2 border-brand bg-transparent text-brand hover:bg-brand hover:text-brand-foreground',
                secondary:
                    'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:-translate-y-0.5',
                ghost: 'hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 dark:hover:bg-accent/50',
                link: 'text-brand underline-offset-4 hover:underline hover:-translate-y-0.5'
            },
            size: {
                default: 'h-9 px-4 py-2 has-[>svg]:px-3',
                sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
                lg: 'h-10 px-6 has-[>svg]:px-4',
                icon: 'size-9',
                'icon-sm': 'size-8',
                'icon-lg': 'size-10'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
);

function Button({
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot='button'
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
