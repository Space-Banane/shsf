import { Fragment, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BASE_URL } from "../..";
import { AppRoute, routes } from "../../Routes";
import { Icon } from "./Icon";

export function NavBar({
	user,
	loading,
	refreshUser,
}: {
	user: any;
	loading: boolean;
	refreshUser: () => void;
}) {
	const location = useLocation();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isAdmin, setIsAdmin] = useState(user?.role === "Admin");
	const documentationLinks = [
		{ name: "SHSF Docs", path: "/docs" },
		{ name: "API Reference", path: "https://api-docs.shsf.dev" },
	];

	useEffect(() => {
		setIsAdmin(user?.role === "Admin");
	}, [user]);

	useEffect(() => {
		setIsMobileMenuOpen(false);
		setIsDropdownOpen(false);
	}, [location.pathname]);

	const handleLogout = () => {
		fetch(`${BASE_URL}/api/logout`, {
			method: "PATCH",
			credentials: "include",
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.status === "OK") {
					refreshUser();
					window.location.href = "/login";
					document.cookie =
						"shsf_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
				}
			})
			.catch((err) => console.error("Logout error:", err));
	};

	const isActive = (path: string) => {
		if (path === "/functions") return location.pathname.startsWith("/functions");
		return location.pathname === path;
	};

	const navRoutes = (routes as AppRoute[])
		.filter((r) => !["Home", "Login", "Register"].includes(r.name))
		.filter((r) => r.show_nav)
		.filter((r) => r.name !== "Docs")
		.sort((a, b) => {
			const order = ["Functions", "Analytics", "Storage", "Cron Jobs", "Guest Users", "Agents"];
			return order.indexOf(a.name) - order.indexOf(b.name);
		})
		.filter((r) => !r.adminOnly || isAdmin);

	const navLinkClass = (path: string) =>
		`px-4 py-1.5 rounded-md text-lg font-medium transition-all duration-200 flex items-center gap-2 border ${
			isActive(path)
				? "bg-primary/10 border-primary/25 text-primary"
				: "border-transparent text-text/75 hover:bg-white/[0.06] hover:text-text hover:border-white/10"
		}`;

	const mobileLinkClass = (path: string) =>
		`block px-4 py-2.5 text-base font-medium rounded-lg transition-colors ${
			isActive(path)
				? "bg-primary/10 text-primary"
				: "text-text/75 hover:bg-white/[0.06] hover:text-text"
		}`;

	return (
		<header className="relative z-40 bg-navbar border-b border-white/[0.07]">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					{/* Logo */}
					<a href="/" className="flex items-center gap-2 shrink-0 group">
						<span className="text-primary font-extrabold text-2xl leading-none group-hover:text-primary/90 transition-colors">
							{"{}"}
						</span>
						<span className="text-primary font-bold text-xl leading-none group-hover:text-primary/90 transition-colors">
							SHSF
						</span>
					</a>

					{/* Desktop nav */}
					<nav className="hidden md:flex items-center gap-1 flex-1 ml-6">
						{navRoutes.map((route, index) => (
							<Fragment key={route.path}>
								{index === 1 && (
									<div className="relative z-50 group">
										<button
											type="button"
											className={`px-4 py-1.5 rounded-md text-lg font-medium transition-all duration-200 flex items-center gap-2 border border-transparent text-text/75 hover:bg-white/[0.06] hover:text-text hover:border-white/10 ${
												location.pathname.startsWith("/docs")
													? "bg-primary/10 border-primary/25 text-primary"
													: ""
											}`}
										>
											<span>Docs</span>
											<Icon
												name="chevron-down"
												className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180"
											/>
										</button>
										<div className="absolute left-0 top-full z-50 hidden pt-1.5 group-hover:block">
											<div className="min-w-[11rem] rounded-lg border border-white/[0.07] bg-surface-raised py-1 shadow-2xl shadow-black/40">
												{documentationLinks.map((link) => (
													<a
														key={link.path}
														href={link.path}
														className="block px-4 py-2 text-sm text-text/75 hover:bg-white/[0.06] hover:text-text transition-colors"
													>
														{link.name}
													</a>
												))}
											</div>
										</div>
									</div>
								)}
								<a href={route.path} className={navLinkClass(route.path)}>
									{route.name}
								</a>
							</Fragment>
						))}
					</nav>

					{/* Right section */}
					<div className="flex items-center gap-2">
						{/* Mobile hamburger */}
						<button
							onClick={() => setIsMobileMenuOpen((v) => !v)}
							className="md:hidden p-2 rounded-md text-text/60 hover:text-text hover:bg-white/[0.06] transition-colors"
							aria-label="Toggle menu"
						>
							{isMobileMenuOpen ? (
								<Icon name="x-mark" className="w-5 h-5" />
							) : (
								<Icon name="bars-3" className="w-5 h-5" />
							)}
						</button>

						{/* User */}
						{loading ? (
							<div className="animate-pulse h-8 w-8 rounded-full bg-white/10" />
						) : user ? (
							<div className="relative">
								<button
									onClick={() => setIsDropdownOpen(!isDropdownOpen)}
									className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
								>
									<div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
										{user.displayName ? user.displayName[0].toUpperCase() : "?"}
									</div>
									<span className="text-text/85 font-medium hidden md:inline">
										{user.displayName}
									</span>
									<Icon
										name="chevron-down"
										className="w-3.5 h-3.5 text-text/40 hidden md:block"
									/>
								</button>
								{isDropdownOpen && (
									<>
										<div
											className="fixed inset-0 z-40"
											onClick={() => setIsDropdownOpen(false)}
										/>
										<div className="absolute right-0 z-50 mt-1.5 w-48 rounded-lg border border-white/[0.07] bg-surface-raised py-1 shadow-2xl shadow-black/40">
											<a
												href="/account"
												className="flex items-center gap-2.5 px-4 py-2 text-sm text-text/80 hover:bg-white/[0.06] hover:text-text transition-colors"
											>
												<Icon name="user" className="w-4 h-4 text-muted" />
												Account
											</a>
											{isAdmin && (
												<a
													href="/admin"
													className="flex items-center gap-2.5 px-4 py-2 text-sm text-text/80 hover:bg-white/[0.06] hover:text-text transition-colors"
												>
													<Icon name="shield-check" className="w-4 h-4 text-muted" />
													Admin
												</a>
											)}
											<hr className="border-white/[0.07] my-1" />
											<button
												onClick={handleLogout}
												className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
											>
												<Icon
													name="arrow-right-on-rectangle"
													className="w-4 h-4"
												/>
												Logout
											</button>
										</div>
									</>
								)}
							</div>
						) : (
							<a
								href="/login"
								className="px-4 py-1.5 bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary rounded-lg text-sm font-medium transition-colors"
							>
								Login
							</a>
						)}
					</div>
				</div>
			</div>

			{/* Mobile menu */}
			{isMobileMenuOpen && (
				<div className="md:hidden border-t border-white/[0.07] bg-navbar px-4 py-3 space-y-1">
					{navRoutes.map((route, index) => (
						<Fragment key={route.path}>
							{index === 1 &&
								documentationLinks.map((link) => (
									<a
										key={link.path}
										href={link.path}
										className={mobileLinkClass(link.path)}
									>
										{link.name}
									</a>
								))}
							<a href={route.path} className={mobileLinkClass(route.path)}>
								{route.name}
							</a>
						</Fragment>
					))}
					<hr className="border-white/[0.07] my-2" />
					{user ? (
						<>
							<a href="/account" className={mobileLinkClass("/account")}>
								Account
							</a>
							{isAdmin && (
								<a href="/admin" className={mobileLinkClass("/admin")}>
									Admin
								</a>
							)}
							<button
								onClick={handleLogout}
								className="block w-full text-left px-4 py-2.5 text-base font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
							>
								Logout
							</button>
						</>
					) : (
						<a href="/login" className={mobileLinkClass("/login")}>
							Login
						</a>
					)}
				</div>
			)}
		</header>
	);
}
