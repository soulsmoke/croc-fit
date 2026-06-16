/**
 * Custom HTML shell for Expo Router static web export.
 * Injected at build time — provides favicon and PWA meta tags.
 * @see https://docs.expo.dev/router/reference/static-rendering/#root-html
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML document — wraps the Expo Router app with proper <head> tags.
 * Only rendered on web; on native the file is ignored.
 */
export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                {/* Favicon — shown in browser tab */}
                <link rel="icon" type="image/png" href="/favicon.png" />
                {/* Apple Touch Icon — shown when added to iOS Home Screen */}
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                {/* PWA meta tags for iOS standalone mode */}
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="CrocFit" />
                {/*
                 * Expo Router CSS reset: disables body scroll when using <ScrollView>,
                 * makes html/body/root full-height.
                 */}
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
