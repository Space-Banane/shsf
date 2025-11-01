
import React, { useEffect, useState } from "react";
import {
	createStorage,
	listStorages,
	deleteStorage,
	clearStorageItems,
	setStorageItem,
	getStorageItem,
	listStorageItems,
	deleteStorageItem,
	Storage,
	StorageItem,
} from "../services/backend.storage";

function StoragePage() {
	const [storages, setStorages] = useState<Storage[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [selectedStorage, setSelectedStorage] = useState<Storage | null>(null);
	const [items, setItems] = useState<StorageItem[]>([]);
	const [itemLoading, setItemLoading] = useState(false);
	const [itemError, setItemError] = useState("");
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [createName, setCreateName] = useState("");
	const [createPurpose, setCreatePurpose] = useState("");
	const [createLoading, setCreateLoading] = useState(false);
	const [createError, setCreateError] = useState("");
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Storage | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [deleteError, setDeleteError] = useState("");
	const [showClearModal, setShowClearModal] = useState(false);
	const [clearLoading, setClearLoading] = useState(false);
	const [clearError, setClearError] = useState("");
	const [showAddItemModal, setShowAddItemModal] = useState(false);
	const [addItemKey, setAddItemKey] = useState("");
	const [addItemValue, setAddItemValue] = useState("");
	const [addItemExpiresAt, setAddItemExpiresAt] = useState("");
	const [addItemLoading, setAddItemLoading] = useState(false);
	const [addItemError, setAddItemError] = useState("");
	const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
	const [deleteItemKey, setDeleteItemKey] = useState<string | null>(null);
	const [deleteItemLoading, setDeleteItemLoading] = useState(false);
	const [deleteItemError, setDeleteItemError] = useState("");
	const [showGetItemModal, setShowGetItemModal] = useState(false);
	const [getItemKey, setGetItemKey] = useState("");
	const [getItemResult, setGetItemResult] = useState<StorageItem | null>(null);
	const [getItemLoading, setGetItemLoading] = useState(false);
	const [getItemError, setGetItemError] = useState("");

	// Load storages
	const loadStorages = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await listStorages();
			if (res.status === "OK") {
				setStorages(res.data);
			} else {
				setError(res.message || "Failed to load storages");
			}
		} catch (e) {
			setError("Failed to load storages");
		} finally {
			setLoading(false);
		}
	};

	// Load items for selected storage
	const loadItems = async (storage: Storage) => {
		setItemLoading(true);
		setItemError("");
		try {
			const res = await listStorageItems(storage.name);
			if (res.status === "OK") {
				setItems(res.data);
			} else {
				setItemError(res.message || "Failed to load items");
			}
		} catch (e) {
			setItemError("Failed to load items");
		} finally {
			setItemLoading(false);
		}
	};

	useEffect(() => {
		loadStorages();
	}, []);

	useEffect(() => {
		if (selectedStorage) {
			loadItems(selectedStorage);
		} else {
			setItems([]);
		}
	}, [selectedStorage]);

	// Create storage
	const handleCreateStorage = async () => {
		setCreateLoading(true);
		setCreateError("");
		try {
			const res = await createStorage({ name: createName, purpose: createPurpose });
			if (res.status === "OK") {
				setShowCreateModal(false);
				setCreateName("");
				setCreatePurpose("");
				loadStorages();
			} else {
				setCreateError(res.message || "Failed to create storage");
			}
		} catch (e) {
			setCreateError("Failed to create storage");
		} finally {
			setCreateLoading(false);
		}
	};

	// Delete storage
	const handleDeleteStorage = async () => {
		if (!deleteTarget) return;
		setDeleteLoading(true);
		setDeleteError("");
		try {
			const res = await deleteStorage(deleteTarget.name);
			if (res.status === "OK") {
				setShowDeleteModal(false);
				setDeleteTarget(null);
				if (selectedStorage?.id === deleteTarget.id) setSelectedStorage(null);
				loadStorages();
			} else {
				setDeleteError(res.message || "Failed to delete storage");
			}
		} catch (e) {
			setDeleteError("Failed to delete storage");
		} finally {
			setDeleteLoading(false);
		}
	};

	// Clear all items in storage
	const handleClearStorage = async () => {
		if (!selectedStorage) return;
		setClearLoading(true);
		setClearError("");
		try {
			const res = await clearStorageItems(selectedStorage.name);
			if (res.status === "OK") {
				setShowClearModal(false);
				loadItems(selectedStorage);
			} else {
				setClearError(res.message || "Failed to clear items");
			}
		} catch (e) {
			setClearError("Failed to clear items");
		} finally {
			setClearLoading(false);
		}
	};

	// Add or update item
	const handleAddItem = async (parsedValue?: any) => {
		if (!selectedStorage) return;
		setAddItemLoading(true);
		setAddItemError("");
		try {
			const payload: any = { key: addItemKey, value: parsedValue !== undefined ? parsedValue : addItemValue };
			if (addItemExpiresAt) payload.expiresAt = addItemExpiresAt;
			const res = await setStorageItem(selectedStorage.name, payload);
			if (res.status === "OK") {
				setShowAddItemModal(false);
				setAddItemKey("");
				setAddItemValue("");
				setAddItemExpiresAt("");
				loadItems(selectedStorage);
			} else {
				setAddItemError(res.message || "Failed to set item");
			}
		} catch (e) {
			setAddItemError("Failed to set item");
		} finally {
			setAddItemLoading(false);
		}
	};

	// Delete item
	const handleDeleteItem = async () => {
		if (!selectedStorage || !deleteItemKey) return;
		setDeleteItemLoading(true);
		setDeleteItemError("");
		try {
			const res = await deleteStorageItem(selectedStorage.name, deleteItemKey);
			if (res.status === "OK") {
				setShowDeleteItemModal(false);
				setDeleteItemKey(null);
				loadItems(selectedStorage);
			} else {
				setDeleteItemError(res.message || "Failed to delete item");
			}
		} catch (e) {
			setDeleteItemError("Failed to delete item");
		} finally {
			setDeleteItemLoading(false);
		}
	};

	// Get item by key
	const handleGetItem = async () => {
		if (!selectedStorage) return;
		setGetItemLoading(true);
		setGetItemError("");
		setGetItemResult(null);
		try {
			const res = await getStorageItem(selectedStorage.name, getItemKey);
			if (res.status === "OK") {
				setGetItemResult(res.data);
			} else {
				setGetItemError(res.message || "Item not found");
			}
		} catch (e) {
			setGetItemError("Failed to get item");
		} finally {
			setGetItemLoading(false);
		}
	};

	// UI
		return (
			<div className="min-h-screen bg-background">
				{/* Hero Header */}
				<div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20">
					<div className="max-w-6xl mx-auto px-4 py-16">
						<div className="text-center space-y-4">
							<h1 className="text-5xl font-bold text-primary mb-4">Storage Manager</h1>
							<div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
							<p className="text-xl text-text/70 max-w-2xl mx-auto">
								Manage your virtual databases (storages), items, and data with ease.
							</p>
						</div>
					</div>
				</div>

				<div className="max-w-6xl mx-auto px-4 py-12">
					{/* If a storage is selected, show only the storage view with a back button */}
					{selectedStorage ? (
						<div className="max-w-3xl mx-auto">
							<button
								className="mb-6 flex items-center gap-2 text-primary font-semibold hover:underline hover:scale-105 transition-all duration-200"
								onClick={() => setSelectedStorage(null)}
							>
								<span className="text-2xl">←</span> Back to Storages
							</button>
							<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-8">
								<div className="flex items-center justify-between mb-6">
									<div>
										<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
											<span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">🗄️</span>
											{selectedStorage.name}
										</h2>
										<div className="text-text/60 text-sm mt-1">{selectedStorage.purpose}</div>
									</div>
									<div className="flex gap-2">
										<button
											className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-[0_0_20px_rgba(124,131,253,0.2)] transition-all duration-300"
											onClick={() => setShowAddItemModal(true)}
										>+ Add Item</button>
										<button
											className="px-4 py-2 bg-background/20 border border-primary/10 rounded-lg text-primary hover:border-primary/30 hover:bg-primary/5 font-semibold transition-all duration-300"
											onClick={() => setShowClearModal(true)}
										>Clear All</button>
										<button
											className="px-4 py-2 bg-background/20 border border-primary/10 rounded-lg text-primary hover:border-primary/30 hover:bg-primary/5 font-semibold transition-all duration-300"
											onClick={() => setShowGetItemModal(true)}
										>Get Item</button>
									</div>
								</div>
								{itemLoading ? (
									<div className="text-center py-8">
										<div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
										<p className="text-text/70">Loading items...</p>
									</div>
								) : itemError ? (
									<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{itemError}</div>
								) : items.length === 0 ? (
									<div className="text-center py-8 text-text/60">No items in this storage.</div>
								) : (
									<div className="overflow-x-auto">
										<table className="min-w-full text-sm">
											<thead>
												<tr className="bg-background/30 border-b border-primary/10">
													<th className="px-4 py-2 text-left text-text/60">Key</th>
													<th className="px-4 py-2 text-left text-text/60">Value</th>
													<th className="px-4 py-2 text-left text-text/60">Expires At</th>
													<th className="px-4 py-2"></th>
												</tr>
											</thead>
											<tbody>
												{items.map(item => (
													<tr key={item.id} className="border-b border-primary/10 hover:bg-primary/5 transition-all duration-200">
														<td className="px-4 py-2 font-mono text-primary break-all">{item.key}</td>
														<td className="px-4 py-2 font-mono text-text break-all">{JSON.stringify(item.value)}</td>
														<td className="px-4 py-2 text-xs text-text/60">{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : <span className="text-text/30">Never</span>}</td>
														<td className="px-4 py-2">
															<button
																className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 hover:scale-110"
																title="Delete item"
																onClick={() => { setDeleteItemKey(item.key); setShowDeleteItemModal(true); }}
															>🗑️</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center">
							<div className="w-full max-w-lg space-y-6">
								<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-6">
									<div className="flex items-center justify-between mb-4">
										<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
											<span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">🗄️</span>
											Storages
										</h2>
										<button
											className="px-3 py-1.5 bg-primary text-background rounded-lg font-semibold hover:scale-105 transition-all duration-300"
											onClick={() => setShowCreateModal(true)}
										>
											+ New
										</button>
									</div>
									{loading ? (
										<div className="text-center py-8">
											<div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
											<p className="text-text/70">Loading storages...</p>
										</div>
									) : error ? (
										<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>
									) : storages.length === 0 ? (
										<div className="text-center py-8 text-text/60">No storages found.</div>
									) : (
										<ul className="space-y-2">
											{storages.map((storage) => (
												<li key={storage.id}>
													<button
														className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 hover:border-primary/30 hover:bg-primary/5`}
														onClick={() => setSelectedStorage(storage)}
													>
														<span className="text-2xl">🗄️</span>
														<div className="flex-1 text-left">
															<div className="font-semibold text-primary">{storage.name}</div>
															<div className="text-xs text-text/60">{storage.purpose}</div>
														</div>
														<button
															className="ml-2 p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 hover:scale-110"
															title="Delete storage"
															onClick={e => { e.stopPropagation(); setDeleteTarget(storage); setShowDeleteModal(true); }}
														>🗑️</button>
													</button>
												</li>
											))}
										</ul>
									)}
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Create Storage Modal */}
			{showCreateModal && (
				<Modal onClose={() => setShowCreateModal(false)}>
					<div className="text-center mb-6">
						<div className="text-5xl mb-2">🗄️</div>
						<h2 className="text-2xl font-bold text-primary mb-2">Create Storage</h2>
						<p className="text-text/70">Create a new virtual database (storage).</p>
					</div>
					<div className="space-y-4">
						<input
							type="text"
							className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
							placeholder="Storage Name"
							value={createName}
							onChange={e => setCreateName(e.target.value)}
							disabled={createLoading}
						/>
						<input
							type="text"
							className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
							placeholder="Purpose (optional)"
							value={createPurpose}
							onChange={e => setCreatePurpose(e.target.value)}
							disabled={createLoading}
						/>
						{createError && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{createError}</div>}
						<div className="flex gap-3 pt-2">
							<button
								onClick={() => setShowCreateModal(false)}
								className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
								disabled={createLoading}
							>Cancel</button>
							<button
								onClick={handleCreateStorage}
								disabled={createLoading || !createName}
								className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
							>{createLoading ? "Creating..." : "Create"}</button>
						</div>
					</div>
				</Modal>
			)}

			{/* Delete Storage Modal */}
			{showDeleteModal && deleteTarget && (
				<Modal onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>
					<div className="text-center mb-6">
						<div className="text-5xl mb-2">⚠️</div>
						<h2 className="text-2xl font-bold text-red-400 mb-2">Delete Storage</h2>
						<p className="text-text/70">Are you sure you want to delete <span className="font-bold text-primary">{deleteTarget.name}</span>? This cannot be undone.</p>
					</div>
					{deleteError && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{deleteError}</div>}
					<div className="flex gap-3 pt-2">
						<button
							onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
							className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
							disabled={deleteLoading}
						>Cancel</button>
						<button
							onClick={handleDeleteStorage}
							disabled={deleteLoading}
							className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed transition-all duration-300"
						>{deleteLoading ? "Deleting..." : "Delete"}</button>
					</div>
				</Modal>
			)}

			{/* Clear Storage Modal */}
			{showClearModal && selectedStorage && (
				<Modal onClose={() => setShowClearModal(false)}>
					<div className="text-center mb-6">
						<div className="text-5xl mb-2">🧹</div>
						<h2 className="text-2xl font-bold text-primary mb-2">Clear All Items</h2>
						<p className="text-text/70">Are you sure you want to clear all items in <span className="font-bold text-primary">{selectedStorage.name}</span>?</p>
					</div>
					{clearError && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{clearError}</div>}
					<div className="flex gap-3 pt-2">
						<button
							onClick={() => setShowClearModal(false)}
							className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
							disabled={clearLoading}
						>Cancel</button>
						<button
							onClick={handleClearStorage}
							disabled={clearLoading}
							className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
						>{clearLoading ? "Clearing..." : "Clear All"}</button>
					</div>
				</Modal>
			)}

			{/* Add Item Modal */}
			{showAddItemModal && selectedStorage && (
				<Modal onClose={() => setShowAddItemModal(false)}>
					<div className="text-center mb-6">
						<div className="text-5xl mb-2">➕</div>
						<h2 className="text-2xl font-bold text-primary mb-2">Add Item</h2>
						<p className="text-text/70">Add or update an item in <span className="font-bold text-primary">{selectedStorage.name}</span>.</p>
					</div>
					<div className="space-y-4">
						<input
							type="text"
							className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
							placeholder="Key"
							value={addItemKey}
							onChange={e => setAddItemKey(e.target.value)}
							disabled={addItemLoading}
						/>
						<textarea
							className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
							placeholder="Value (JSON or string)"
							value={addItemValue}
							onChange={e => setAddItemValue(e.target.value)}
							disabled={addItemLoading}
							rows={3}
						/>
						<input
							type="datetime-local"
							className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
							placeholder="Expires At (optional)"
							value={addItemExpiresAt}
							onChange={e => setAddItemExpiresAt(e.target.value)}
							disabled={addItemLoading}
						/>
						{addItemError && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{addItemError}</div>}
						<div className="flex gap-3 pt-2">
							<button
								onClick={() => setShowAddItemModal(false)}
								className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
								disabled={addItemLoading}
							>Cancel</button>
							<button
								onClick={() => {
									// Try to parse value as JSON, fallback to string
									let value = addItemValue;
									try { value = JSON.parse(addItemValue); } catch {
										// Intentionally ignore JSON parse errors and use the string value
									}
									handleAddItem(value);
								}}
								disabled={addItemLoading || !addItemKey}
								className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
							>{addItemLoading ? "Saving..." : "Save"}</button>
						</div>
					</div>
				</Modal>
			)}

			{/* Delete Item Modal */}
			{showDeleteItemModal && selectedStorage && deleteItemKey && (
				<Modal onClose={() => { setShowDeleteItemModal(false); setDeleteItemKey(null); }}>
					<div className="text-center mb-6">
						<div className="text-5xl mb-2">⚠️</div>
						<h2 className="text-2xl font-bold text-red-400 mb-2">Delete Item</h2>
						<p className="text-text/70">Are you sure you want to delete the item <span className="font-bold text-primary">{deleteItemKey}</span>?</p>
					</div>
					{deleteItemError && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{deleteItemError}</div>}
					<div className="flex gap-3 pt-2">
						<button
							onClick={() => { setShowDeleteItemModal(false); setDeleteItemKey(null); }}
							className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
							disabled={deleteItemLoading}
						>Cancel</button>
						<button
							onClick={handleDeleteItem}
							disabled={deleteItemLoading}
							className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed transition-all duration-300"
						>{deleteItemLoading ? "Deleting..." : "Delete"}</button>
					</div>
				</Modal>
			)}

			{/* Get Item Modal */}
			{showGetItemModal && selectedStorage && (
				<Modal onClose={() => { setShowGetItemModal(false); setGetItemKey(""); setGetItemResult(null); setGetItemError(""); }}>
					<div className="text-center mb-6">
						<div className="text-5xl mb-2">🔍</div>
						<h2 className="text-2xl font-bold text-primary mb-2">Get Item by Key</h2>
						<p className="text-text/70">Retrieve a single item from <span className="font-bold text-primary">{selectedStorage.name}</span> by key.</p>
					</div>
					<div className="space-y-4">
						<input
							type="text"
							className="w-full px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text focus:border-primary/50 focus:outline-none font-mono"
							placeholder="Key"
							value={getItemKey}
							onChange={e => setGetItemKey(e.target.value)}
							disabled={getItemLoading}
						/>
						<div className="flex gap-3 pt-2">
							<button
								onClick={() => { setShowGetItemModal(false); setGetItemKey(""); setGetItemResult(null); setGetItemError(""); }}
								className="flex-1 px-4 py-3 bg-background/50 border border-primary/20 rounded-lg text-text hover:border-primary/40 transition-all duration-300"
								disabled={getItemLoading}
							>Cancel</button>
							<button
								onClick={handleGetItem}
								disabled={getItemLoading || !getItemKey}
								className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-all duration-300"
							>{getItemLoading ? "Searching..." : "Get Item"}</button>
						</div>
						{getItemError && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">{getItemError}</div>}
						{getItemResult && (
							<div className="bg-background/30 border border-primary/10 rounded-xl p-4 mt-2">
								<div className="font-mono text-primary mb-1">Key: {getItemResult.key}</div>
								<div className="font-mono text-text mb-1">Value: {JSON.stringify(getItemResult.value)}</div>
								<div className="text-xs text-text/60">Expires At: {getItemResult.expiresAt ? new Date(getItemResult.expiresAt).toLocaleString() : <span className="text-text/30">Never</span>}</div>
							</div>
						)}
					</div>
				</Modal>
			)}

		</div>
	);
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-primary/20 rounded-2xl p-8 max-w-md w-full relative">
				<button
					onClick={onClose}
					className="absolute top-3 right-3 text-text/60 hover:text-primary text-2xl font-bold"
					aria-label="Close"
				>×</button>
				{children}
			</div>
		</div>
	);
}

export default StoragePage;
