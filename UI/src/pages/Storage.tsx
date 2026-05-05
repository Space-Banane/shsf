import React, { useEffect, useState } from "react";
import {
	listStorages,
	listStorageItems,
	Storage,
	StorageItem,
} from "../services/backend.storage";
import CreateStorageModal from "../components/modals/storage/CreateStorageModal";
import DeleteStorageModal from "../components/modals/storage/DeleteStorageModal";
import ClearStorageModal from "../components/modals/storage/ClearStorageModal";
import AddStorageItemModal from "../components/modals/storage/AddStorageItemModal";
import DeleteStorageItemModal from "../components/modals/storage/DeleteStorageItemModal";
import GetStorageItemModal from "../components/modals/storage/GetStorageItemModal";

function StoragePage() {
	const [storages, setStorages] = useState<Storage[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [selectedStorage, setSelectedStorage] = useState<Storage | null>(null);
	const [items, setItems] = useState<StorageItem[]>([]);
	const [itemLoading, setItemLoading] = useState(false);
	const [itemError, setItemError] = useState("");
	
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Storage | null>(null);
	const [showClearModal, setShowClearModal] = useState(false);
	const [showAddItemModal, setShowAddItemModal] = useState(false);
	const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
	const [deleteItemKey, setDeleteItemKey] = useState<string | null>(null);
	const [showGetItemModal, setShowGetItemModal] = useState(false);
	const [editingItem, setEditingItem] = useState<StorageItem | null>(null);

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
										<span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
											🗄️
										</span>
										{selectedStorage.name}
									</h2>
									<div className="text-text/60 text-sm mt-1">
										{selectedStorage.purpose}
									</div>
								</div>
								<div className="flex gap-2">
									<button
										className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-[0_0_20px_rgba(124,131,253,0.2)] transition-all duration-300"
										onClick={() => {
											setEditingItem(null);
											setShowAddItemModal(true);
										}}
									>
										+ Add Item
									</button>
									<button
										className="px-4 py-2 bg-background/20 border border-primary/10 rounded-lg text-primary hover:border-primary/30 hover:bg-primary/5 font-semibold transition-all duration-300"
										onClick={() => setShowClearModal(true)}
									>
										Clear All
									</button>
									<button
										className="px-4 py-2 bg-background/20 border border-primary/10 rounded-lg text-primary hover:border-primary/30 hover:bg-primary/5 font-semibold transition-all duration-300"
										onClick={() => setShowGetItemModal(true)}
									>
										Get Item
									</button>
								</div>
							</div>
							{itemLoading ? (
								<div className="text-center py-8">
									<div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
									<p className="text-text/70">Loading items...</p>
								</div>
							) : itemError ? (
								<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
									{itemError}
								</div>
							) : items.length === 0 ? (
								<div className="text-center py-8 text-text/60">
									No items in this storage.
								</div>
							) : (
								<div className="space-y-3">
									<div className="text-xs text-text/50">
										Use the edit button on any item to update its value or clear its
										expiry.
									</div>
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
											{items.map((item) => (
												<tr
													key={item.id}
													className="border-b border-primary/10 hover:bg-primary/5 transition-all duration-200"
												>
													<td className="px-4 py-2 font-mono text-primary break-all">
														{item.key}
													</td>
													<td className="px-4 py-2 font-mono text-text break-all">
														{JSON.stringify(item.value)}
													</td>
													<td className="px-4 py-2 text-xs text-text/60">
														{item.expiresAt ? (
															new Date(item.expiresAt).toLocaleString()
														) : (
															<span className="text-text/30">Never</span>
														)}
													</td>
													<td className="px-4 py-2">
														<div className="flex items-center justify-end gap-1">
															<button
																className="p-1.5 text-blue-300 hover:bg-blue-400/10 rounded-lg transition-all duration-300 hover:scale-110"
																title="Edit item"
																onClick={() => {
																	setEditingItem(item);
																	setShowAddItemModal(true);
																}}
															>
																✏️
															</button>
															<button
																className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 hover:scale-110"
																title="Delete item"
																onClick={() => {
																	setDeleteItemKey(item.key);
																	setShowDeleteItemModal(true);
																}}
															>
																🗑️
															</button>
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
									</div>
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
										<span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
											🗄️
										</span>
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
									<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
										{error}
									</div>
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
														onClick={(e) => {
															e.stopPropagation();
															setDeleteTarget(storage);
															setShowDeleteModal(true);
														}}
													>
														🗑️
													</button>
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

			<CreateStorageModal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onSuccess={loadStorages}
			/>

			<DeleteStorageModal
				isOpen={showDeleteModal}
				onClose={() => {
					setShowDeleteModal(false);
					setDeleteTarget(null);
				}}
				onSuccess={() => {
					if (selectedStorage?.id === deleteTarget?.id) setSelectedStorage(null);
					loadStorages();
				}}
				target={deleteTarget}
			/>

			<ClearStorageModal
				isOpen={showClearModal}
				onClose={() => setShowClearModal(false)}
				onSuccess={() => selectedStorage && loadItems(selectedStorage)}
				selectedStorage={selectedStorage}
			/>

			<AddStorageItemModal
				isOpen={showAddItemModal}
				onClose={() => {
					setShowAddItemModal(false);
					setEditingItem(null);
				}}
				onSuccess={() => selectedStorage && loadItems(selectedStorage)}
				selectedStorage={selectedStorage}
				initialItem={editingItem}
			/>

			<DeleteStorageItemModal
				isOpen={showDeleteItemModal}
				onClose={() => {
					setShowDeleteItemModal(false);
					setDeleteItemKey(null);
				}}
				onSuccess={() => selectedStorage && loadItems(selectedStorage)}
				selectedStorage={selectedStorage}
				deleteItemKey={deleteItemKey}
			/>

			<GetStorageItemModal
				isOpen={showGetItemModal}
				onClose={() => setShowGetItemModal(false)}
				selectedStorage={selectedStorage}
			/>
		</div>
	);
}

export default StoragePage;
