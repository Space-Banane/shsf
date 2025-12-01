import { useContext, useState } from "react";
import { UserContext } from "../App";
import { deleteAccount, exportAccountData } from "../services/backend.account";

export const AccountPage = ({}) => {
	const { user, refreshUser, loading } = useContext(UserContext);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState("");
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState("");
	const [exportLoading, setExportLoading] = useState(false);

	const handleDeleteAccount = async () => {
		if (deleteConfirmation !== "DELETE_MY_ACCOUNT") {
			setDeleteError("Please type 'DELETE_MY_ACCOUNT' to confirm");
			return;
		}

		setDeleteLoading(true);
		setDeleteError("");

		try {
			const result = await deleteAccount(deleteConfirmation);

			if (result.status === "OK") {
				// Redirect to home page or login page
				window.location.href = "/";
			} else {
				setDeleteError(result.message);
			}
		} catch (error) {
			setDeleteError("An error occurred while deleting your account");
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleExportData = async () => {
		setExportLoading(true);
		try {
			const response = await exportAccountData();
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `shsf-account-export-${new Date().toISOString().split("T")[0]}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Export failed:", error);
			// You could show an error toast here
		} finally {
			setExportLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center space-y-4">
					<div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
					<p className="text-text/70 text-lg">Loading account information...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Hero Header Section */}
			<div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20">
				<div className="max-w-6xl mx-auto px-4 py-16">
					<div className="text-center space-y-4">
						<h1 className="text-5xl font-bold text-primary mb-4">
							Account Dashboard
						</h1>
						<div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
						<p className="text-xl text-text/70 max-w-2xl mx-auto">
							Manage your profile, settings, and account preferences
						</p>
					</div>
				</div>
			</div>

			<div className="max-w-6xl mx-auto px-4 py-12">
				{user ? (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
						{/* Profile Card */}
						<div className="lg:col-span-2">
							<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-8 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(124,131,253,0.1)] transition-all duration-300">
								<h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-3">
									<div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
										👤
									</div>
									Profile Information
								</h2>

								{/* Avatar and Basic Info */}
								<div className="flex items-center mb-8 p-6 bg-background/50 rounded-xl border border-primary/10">
									<div className="flex-1">
										<h3 className="text-2xl font-bold text-text mb-2">{user.email}</h3>
										<div className="flex items-center gap-2 text-text/60">
											<span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm font-medium">
												Active User
											</span>
											<span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium">
												Verified
											</span>
										</div>
									</div>
								</div>

								{/* Account Details Grid */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<DetailCard
										icon="📧"
										label="Email Address"
										value={user.email}
										subtitle="Primary contact method"
									/>
									<DetailCard
										icon="📅"
										label="Account Since"
										value={
											user.createdAt
												? new Date(user.createdAt).toLocaleDateString("en-US", {
														year: "numeric",
														month: "long",
														day: "numeric",
													})
												: "Unknown"
										}
										subtitle="Account creation date"
									/>
								</div>
							</div>
						</div>

						{/* Action Cards Sidebar */}
						<div className="space-y-6">
							{/* Quick Actions */}
							<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-6 hover:border-primary/40 transition-all duration-300">
								<h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
									<div className="w-6 h-6 bg-primary/20 rounded-lg flex items-center justify-center text-sm">
										⚡
									</div>
									Quick Actions
								</h3>
								<div className="space-y-3">
									<ActionButton
										icon="🔄"
										label="Refresh Profile"
										description="Update account data"
										onClick={() => refreshUser()}
									/>
									<ActionButton
										icon="📥"
										label={exportLoading ? "Exporting..." : "Export Data"}
										description="Download account data as JSON"
										onClick={handleExportData}
									/>
									<ActionButton
										icon="🚀"
										label="My Functions"
										description="View deployed functions"
										onClick={() => (window.location.href = "/functions")}
									/>
									<ActionButton
										icon="📚"
										label="Documentation"
										description="Learn more about SHSF"
										onClick={() => (window.location.href = "/docs")}
									/>
									<ActionButton
										icon="🔑"
										label="Access Tokens"
										description="Manage your access tokens"
										onClick={() => (window.location.href = "/access-tokens")}
									/>
								</div>
							</div>

							{/* Danger Zone */}
							<div className="bg-gradient-to-br from-red-900/20 to-red-800/20 border border-red-500/30 rounded-2xl p-6">
								<h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
									<div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center text-sm">
										⚠️
									</div>
									Danger Zone
								</h3>
								<p className="text-red-300/70 text-sm mb-4">
									This action cannot be undone. All your functions and data will be
									permanently deleted.
								</p>
								<button
									onClick={() => setShowDeleteModal(true)}
									className="w-full p-3 bg-red-500/20 border border-red-500/30 rounded-lg hover:border-red-500/50 hover:bg-red-500/30 transition-all duration-300 text-red-300 font-semibold"
								>
									Delete Account
								</button>
							</div>
						</div>
					</div>
				) : (
					<div className="text-center py-16">
						<div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-2xl p-12 max-w-md mx-auto">
							<div className="text-6xl mb-4">❌</div>
							<h2 className="text-2xl font-bold text-red-400 mb-4">No Account Data</h2>
							<p className="text-text/70 mb-6">
								Unable to load your account information at this time.
							</p>
							<button
								onClick={() => refreshUser()}
								className="px-6 py-3 bg-primary text-background font-bold rounded-xl hover:shadow-[0_0_20px_rgba(124,131,253,0.3)] hover:scale-105 transition-all duration-300"
							>
								Try Again
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Delete Account Modal */}
			{showDeleteModal && (
				<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-red-500/30 rounded-2xl p-8 max-w-md w-full">
						<div className="text-center mb-6">
							<div className="text-6xl mb-4">⚠️</div>
							<h2 className="text-2xl font-bold text-red-400 mb-2">Delete Account</h2>
							<p className="text-text/70">
								This action cannot be undone. All your data will be permanently deleted.
							</p>
						</div>

						<div className="space-y-4">
							<div>
								<label className="block text-text/70 text-sm font-medium mb-2">
									Type "DELETE_MY_ACCOUNT" to confirm
								</label>
								<input
									type="text"
									value={deleteConfirmation}
									onChange={(e) => setDeleteConfirmation(e.target.value)}
									className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
									placeholder="DELETE_MY_ACCOUNT"
								/>
							</div>

							{deleteError && (
								<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
									{deleteError}
								</div>
							)}

							<div className="flex gap-3 pt-4">
								<button
									onClick={() => {
										setShowDeleteModal(false);
										setDeleteConfirmation("");
										setDeleteError("");
									}}
									className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
									disabled={deleteLoading}
								>
									Cancel
								</button>
								<button
									onClick={handleDeleteAccount}
									disabled={deleteLoading || deleteConfirmation !== "DELETE_MY_ACCOUNT"}
									className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed transition-all duration-300"
								>
									{deleteLoading ? "Deleting..." : "Delete Account"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

function DetailCard({
	icon,
	label,
	value,
	subtitle,
	mono = false,
	truncate = false,
}: {
	icon: string;
	label: string;
	value: string;
	subtitle?: string;
	mono?: boolean;
	truncate?: boolean;
}) {
	return (
		<div className="bg-background/30 border border-primary/10 rounded-xl p-4 hover:border-primary/20 transition-all duration-300">
			<div className="flex items-start gap-3">
				<div className="text-2xl">{icon}</div>
				<div className="flex-1 min-w-0">
					<p className="text-text/60 text-sm font-medium mb-1">{label}</p>
					<p
						className={`text-text font-semibold ${mono ? "font-mono text-sm" : ""} ${truncate ? "truncate" : ""}`}
					>
						{value}
					</p>
					{subtitle && <p className="text-text/40 text-xs mt-1">{subtitle}</p>}
				</div>
			</div>
		</div>
	);
}

function ActionButton({
	icon,
	label,
	description,
	onClick,
}: {
	icon: string;
	label: string;
	description: string;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className="w-full p-3 bg-background/20 border border-primary/10 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 text-left group"
		>
			<div className="flex items-center gap-3">
				<div className="text-xl group-hover:scale-110 transition-transform duration-300">
					{icon}
				</div>
				<div className="flex-1">
					<p className="text-text font-semibold text-sm">{label}</p>
					<p className="text-text/60 text-xs">{description}</p>
				</div>
				<div className="text-primary/60 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300">
					→
				</div>
			</div>
		</button>
	);
}

function StatItem({
	label,
	value,
	color,
}: {
	label: string;
	value: string;
	color: "blue" | "green" | "purple";
}) {
	const colorClasses = {
		blue: "from-blue-500/20 to-blue-600/20 text-blue-300",
		green: "from-green-500/20 to-green-600/20 text-green-300",
		purple: "from-purple-500/20 to-purple-600/20 text-purple-300",
	};

	return (
		<div className={`bg-gradient-to-r ${colorClasses[color]} rounded-lg p-3`}>
			<div className="flex justify-between items-center">
				<p className="text-text/70 text-sm font-medium">{label}</p>
				<p className="text-text font-bold">{value}</p>
			</div>
		</div>
	);
}
