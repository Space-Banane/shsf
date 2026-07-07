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
import { Icon } from "../components/ui/Icon";

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

	const loadStorages = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await listStorages();
			if (res.status === "OK") setStorages(res.data);
			else setError(res.message || "Failed to load storages");
		} catch { setError("Failed to load storages"); }
		finally { setLoading(false); }
	};

	const loadItems = async (storage: Storage) => {
		setItemLoading(true);
		setItemError("");
		try {
			const res = await listStorageItems(storage.name);
			if (res.status === "OK") setItems(res.data);
			else setItemError(res.message || "Failed to load items");
		} catch { setItemError("Failed to load items"); }
		finally { setItemLoading(false); }
	};

	useEffect(() => { loadStorages(); }, []);
	useEffect(() => {
		if (selectedStorage) loadItems(selectedStorage);
		else setItems([]);
	}, [selectedStorage]);

	const btnSecondary = "px-3 py-1.5 border border-white/[0.07] text-text/70 text-sm font-medium rounded-lg hover:bg-surface-raised hover:text-text hover:border-primary/20 transition-colors";
	const btnPrimary = "px-3 py-1.5 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors";

	return (
		<div>
			{selectedStorage ? (
				<>
					{/* Storage detail view */}
					<div className="flex items-center gap-3 mb-6">
						<button
							onClick={() => setSelectedStorage(null)}
							className="p-1.5 text-muted hover:text-text hover:bg-surface rounded-lg transition-colors"
						>
							<Icon name="chevron-left" className="w-4 h-4" />
						</button>
						<div>
							<h1 className="text-2xl font-semibold text-text">{selectedStorage.name}</h1>
							{selectedStorage.purpose && (
								<p className="text-sm text-muted mt-0.5">{selectedStorage.purpose}</p>
							)}
						</div>
					</div>

					<div className="bg-surface border border-white/[0.07] rounded-xl">
						<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
							<span className="text-sm text-muted">{items.length} item{items.length !== 1 ? "s" : ""}</span>
							<div className="flex gap-2">
								<button className={btnSecondary} onClick={() => setShowGetItemModal(true)}>
									Get Item
								</button>
								<button className={btnSecondary} onClick={() => setShowClearModal(true)}>
									Clear All
								</button>
								<button
									className={btnPrimary}
									onClick={() => { setEditingItem(null); setShowAddItemModal(true); }}
								>
									+ Add Item
								</button>
							</div>
						</div>

						{itemLoading ? (
							<div className="flex items-center justify-center py-12">
								<div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
							</div>
						) : itemError ? (
							<p className="px-5 py-4 text-sm text-red-400">{itemError}</p>
						) : items.length === 0 ? (
							<p className="px-5 py-10 text-sm text-muted text-center">No items in this storage.</p>
						) : (
							<div className="overflow-x-auto">
								<table className="min-w-full text-sm">
									<thead>
										<tr className="border-b border-white/[0.07]">
											<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Key</th>
											<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Value</th>
											<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Expires At</th>
											<th className="px-5 py-3 w-20" />
										</tr>
									</thead>
									<tbody className="divide-y divide-white/[0.04]">
										{items.map((item) => (
											<tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
												<td className="px-5 py-3 font-mono text-primary text-xs break-all">{item.key}</td>
												<td className="px-5 py-3 font-mono text-text/80 text-xs break-all max-w-xs truncate">{JSON.stringify(item.value)}</td>
												<td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
													{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : <span className="text-muted/40">Never</span>}
												</td>
												<td className="px-5 py-3">
													<div className="flex items-center justify-end gap-1">
														<button
															className="p-1.5 text-muted hover:text-text hover:bg-white/[0.06] rounded transition-colors"
															title="Edit"
															onClick={() => { setEditingItem(item); setShowAddItemModal(true); }}
														>
															<Icon name="pencil" className="w-3.5 h-3.5" />
														</button>
														<button
															className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
															title="Delete"
															onClick={() => { setDeleteItemKey(item.key); setShowDeleteItemModal(true); }}
														>
															<Icon name="trash" className="w-3.5 h-3.5" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</>
			) : (
				<>
					{/* Storage list */}
					<div className="flex items-center justify-between mb-6">
						<div>
							<h1 className="text-2xl font-semibold text-text">Storage</h1>
							<p className="text-sm text-muted mt-0.5">Persistent key-value databases for your functions</p>
						</div>
						<button className={btnPrimary} onClick={() => setShowCreateModal(true)}>
							<span className="flex items-center gap-1.5">
								<Icon name="plus" className="w-4 h-4" />
								New Storage
							</span>
						</button>
					</div>

					<div className="bg-surface border border-white/[0.07] rounded-xl">
						{loading ? (
							<div className="flex items-center justify-center py-12">
								<div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
							</div>
						) : error ? (
							<p className="px-5 py-4 text-sm text-red-400">{error}</p>
						) : storages.length === 0 ? (
							<div className="flex flex-col items-center py-16 text-center">
								<div className="w-10 h-10 rounded-xl bg-background border border-white/[0.07] flex items-center justify-center mb-3">
									<Icon name="circle-stack" className="w-5 h-5 text-primary/40" />
								</div>
								<p className="text-sm text-muted">No storages yet. Create one to get started.</p>
							</div>
						) : (
							<ul className="divide-y divide-white/[0.04]">
								{storages.map((storage) => (
									<li key={storage.id}>
										<button
											className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group text-left"
											onClick={() => setSelectedStorage(storage)}
										>
											<Icon name="circle-stack" className="w-4 h-4 text-primary/50 shrink-0" />
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-text group-hover:text-primary transition-colors">{storage.name}</p>
												{storage.purpose && <p className="text-xs text-muted truncate">{storage.purpose}</p>}
											</div>
											<button
												className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
												title="Delete"
												onClick={(e) => { e.stopPropagation(); setDeleteTarget(storage); setShowDeleteModal(true); }}
											>
												<Icon name="trash" className="w-3.5 h-3.5" />
											</button>
											<Icon name="chevron-right" className="w-4 h-4 text-muted/40 shrink-0" />
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</>
			)}

			<CreateStorageModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={loadStorages} />
			<DeleteStorageModal
				isOpen={showDeleteModal}
				onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
				onSuccess={() => { if (selectedStorage?.id === deleteTarget?.id) setSelectedStorage(null); loadStorages(); }}
				target={deleteTarget}
			/>
			<ClearStorageModal isOpen={showClearModal} onClose={() => setShowClearModal(false)} onSuccess={() => selectedStorage && loadItems(selectedStorage)} selectedStorage={selectedStorage} />
			<AddStorageItemModal
				isOpen={showAddItemModal}
				onClose={() => { setShowAddItemModal(false); setEditingItem(null); }}
				onSuccess={() => selectedStorage && loadItems(selectedStorage)}
				selectedStorage={selectedStorage}
				initialItem={editingItem}
			/>
			<DeleteStorageItemModal
				isOpen={showDeleteItemModal}
				onClose={() => { setShowDeleteItemModal(false); setDeleteItemKey(null); }}
				onSuccess={() => selectedStorage && loadItems(selectedStorage)}
				selectedStorage={selectedStorage}
				deleteItemKey={deleteItemKey}
			/>
			<GetStorageItemModal isOpen={showGetItemModal} onClose={() => setShowGetItemModal(false)} selectedStorage={selectedStorage} />
		</div>
	);
}

export default StoragePage;
