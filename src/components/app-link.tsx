import {
    Link as RouterLink,
    type LinkProps as RouterLinkProps
} from 'react-router-dom';

type AppLinkProps = Omit<RouterLinkProps, 'to'> & {
    href: string;
};

function isInternal(href: string) {
    return href.startsWith('/') && !href.startsWith('//');
}

function AppLink({ href, children, ...rest }: AppLinkProps) {
    if (isInternal(href)) {
        return (
            <RouterLink to={href} {...rest}>
                {children}
            </RouterLink>
        );
    }
    const target = rest.target;
    return (
        <a
            href={href}
            {...rest}
            rel={target ? 'noopener noreferrer' : rest.rel}
        >
            {children}
        </a>
    );
}

/** Drop-in for `next/link` (uses `href`). */
export default AppLink;
export { AppLink };
