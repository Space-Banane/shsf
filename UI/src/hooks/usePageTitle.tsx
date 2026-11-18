import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

export const PAGE_TITLE_SITE = "SHSF";
export const PAGE_TITLE_SEPARATOR = " · ";

/**
 * Translation keys for titles that are not derived from route metadata.
 * They resolve to English here until the i18n layer (#153) provides catalogs.
 */
export const pageTitleKeys = {
	notFound: "common:pageTitle.notFound",
	unavailable: "common:pageTitle.unavailable",
	functionFallback: "functions:pageTitle.detail",
} as const;

export type PageTitleKey = (typeof pageTitleKeys)[keyof typeof pageTitleKeys];

const pageTitleMessages: Record<string, string | null> = {
	// Home shows the bare site name instead of `<page> · SHSF`.
	"common:pageTitle.route.home": null,
	[pageTitleKeys.notFound]: "Not Found",
	[pageTitleKeys.unavailable]: "Unavailable",
	[pageTitleKeys.functionFallback]: "Function",
};

/** Resolves a title key; `null` means the bare site name. */
export function resolvePageTitle(
	key: PageTitleKey | string,
	fallback: string | null = null,
): string | null {
	return key in pageTitleMessages ? pageTitleMessages[key] : fallback;
}

/** `<page> · SHSF`, or the bare site name when no page label is known. */
export function formatPageTitle(label: string | null | undefined): string {
	const trimmed = label?.trim();
	return trimmed ? `${trimmed}${PAGE_TITLE_SEPARATOR}${PAGE_TITLE_SITE}` : PAGE_TITLE_SITE;
}

/**
 * Stable translation key for a route's `name` metadata, so static page titles
 * are defined once next to the nav label instead of being duplicated here.
 */
export function routePageTitleKey(routeName: string): string {
	const slug = routeName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `common:pageTitle.route.${slug}`;
}

export function routePageTitle(routeName: string): string | null {
	return resolvePageTitle(routePageTitleKey(routeName), routeName);
}

export type PageTitleHandle = { pageTitle?: string | null };

type TitleOverride = { locationKey: string; label: string | null };

const PageTitleContext = createContext<(label: string | null) => void>(() => {});

/**
 * Owns `document.title` for the app. The route supplies the generic label from
 * its metadata; a page may refine it with an entity name through
 * `usePageTitle`. The title present before mount is restored on unmount.
 */
export function PageTitleProvider({
	title,
	children,
}: {
	title: string | null;
	children: ReactNode;
}) {
	const location = useLocation();
	const [override, setOverride] = useState<TitleOverride | null>(null);

	const setOverrideTitle = useCallback(
		(label: string | null) => {
			setOverride({ locationKey: location.key, label });
		},
		[location.key],
	);

	// An override belongs to the route that registered it, so navigating away
	// falls back to the new route's generic title instead of a stale name.
	const activeLabel = override?.locationKey === location.key ? override.label : null;
	const documentTitle = formatPageTitle(activeLabel ?? title);

	useEffect(() => {
		const previousTitle = document.title;
		document.title = documentTitle;
		return () => {
			document.title = previousTitle;
		};
	}, [documentTitle]);

	return (
		<PageTitleContext.Provider value={setOverrideTitle}>
			{children}
		</PageTitleContext.Provider>
	);
}

/**
 * Refines the current page title, typically with an entity name once it has
 * loaded. Passing `null` keeps the route's generic title.
 */
export function usePageTitle(label: string | null | undefined) {
	const setOverrideTitle = useContext(PageTitleContext);

	useEffect(() => {
		setOverrideTitle(label ?? null);
		return () => setOverrideTitle(null);
	}, [label, setOverrideTitle]);
}
