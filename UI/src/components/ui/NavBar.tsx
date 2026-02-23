import { useEffect, useState } from "react";
import { BASE_URL } from "../..";
import { routes } from "../../Routes";

export function NavBar({
	user,
	loading,
	refreshUser,
}: {
	user: any;
	loading: boolean;
	refreshUser: () => void;
}) {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isAdmin, setIsAdmin] = useState(user?.role === "Admin");

	useEffect(() => {
		setIsAdmin(user?.role === "Admin");
	}, [user]);

	const handleLogout = () => {
		fetch(`${BASE_URL}/api/logout`, {
			method: "PATCH",
			credentials: "include",
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.status === "OK") {
					refreshUser(); // Refresh user data to reflect logout
					window.location.href = "/login"; // Redirect to login
					document.cookie =
						"shsf_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
				}
			})
			.catch((err) => console.error("Logout error:", err));
	};

	return (
		<header className="bg-navbar border-b border-blue-700/30">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					{/* Logo */}
					<div className="flex items-center">
						<a href="/" className="text-2xl font-bold">
							<h2 className="space-x-2 text-primary inline font-extrabold text-3xl mr-2">
								{"{}"}
							</h2>{" "}
							{/* Peak logo */}
							<h3 className="inline text-primary">SHSF</h3>
						</a>
					</div>
					{/* Navigation Links */}
					<nav className="hidden md:flex items-center space-x-2">
						{routes
							.filter((route) => !["Login", "Register"].includes(route.name))
							.filter((route) => route.show_nav)
							.filter((route) => !route.adminOnly || isAdmin)
							.map((route) => (
								<a
									key={route.path}
									href={route.path}
									className="px-4 py-1.5 rounded-md text-text hover:bg-[#383863] transition-all duration-200 text-lg font-medium border border-transparent hover:border-purple-500/20 flex items-center space-x-2"
								>
									<span>{route.name}</span>
								</a>
							))}
					</nav>

					{/* User Section */}
					<div className="flex items-center">
						{loading ? (
							<div className="animate-pulse h-8 w-8 rounded-full bg-[#383863]"></div>
						) : user ? (
							<div className="relative">
								<button
									onClick={() => setIsDropdownOpen(!isDropdownOpen)}
									className="flex items-center space-x-2 focus:outline-none"
								>
									<div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
										{user.displayName ? user.displayName[0].toUpperCase() : "?"}
									</div>
									<span className="text-text font-semibold text-lg hidden md:inline">
										{user.displayName}
									</span>
								</button>
								{isDropdownOpen && (
									<div className="absolute right-0 mt-2 w-48 bg-[#282844] rounded-md shadow-lg py-1 z-10 border border-purple-500/20">
										<a
											href="/account"
											className="block w-full text-left px-4 py-2 text-sm text-text hover:bg-[#383863]"
										>
											Account
										</a>
										{isAdmin && (
											<a
												href="/admin"
												className="block w-full text-left px-4 py-2 text-sm text-text hover:bg-[#383863]"
											>
												Admin
											</a>
										)}
										<button
											onClick={handleLogout}
											className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-[#383863]"
										>
											Logout
										</button>
									</div>
								)}
							</div>
						) : (
							<a
								href="/login"
								className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150 border border-purple-500/20"
							>
								Login
							</a>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}
