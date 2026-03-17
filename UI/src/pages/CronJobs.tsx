import React, { useEffect, useState } from "react";
import {
	listAllTriggers,
	deleteTrigger,
	updateTrigger,
	createTrigger,
} from "../services/backend.triggers";
import { getFunctions } from "../services/backend.functions";
import { Trigger, XFunction } from "../types/Prisma";
import EditTriggerModal from "../components/modals/EditTriggerModal";
import DeleteTriggerModal from "../components/modals/DeleteTriggerModal";
import CreateTriggerModal from "../components/modals/CreateTriggerModal";
import { ActionButton } from "../components/buttons/ActionButton";
import { Link } from "react-router-dom";

function CronJobsPage() {
	const [triggers, setTriggers] = useState<(Trigger & { function: { name: string } })[]>([]);
	const [functions, setFunctions] = useState<XFunction[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showEditModal, setShowEditModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [selectedTrigger, setSelectedTrigger] = useState<(Trigger & { function: { name: string } }) | null>(null);

	const loadData = async () => {
		setLoading(true);
		setError("");
		try {
			const [triggerRes, functionRes] = await Promise.all([
				listAllTriggers(),
				getFunctions(true)
			]);

			if (triggerRes.status === "OK") {
				setTriggers(triggerRes.data);
			} else {
				setError(triggerRes.message || "Failed to load triggers");
			}

			if (functionRes.status === "OK") {
				setFunctions(functionRes.data as unknown as XFunction[]);
			}
		} catch (e) {
			setError("Failed to load data");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	const handleCreateTrigger = async (
		functionId: number,
		name: string,
		description: string,
		cron: string,
		data: string,
		enabled: boolean,
	) => {
		try {
			const res = await createTrigger(functionId, {
				name,
				description,
				cron,
				data,
				enabled,
			});
			if (res.status === "OK") {
				loadData();
				setShowCreateModal(false);
				return true;
			} else {
				alert(res.message);
				return false;
			}
		} catch (e) {
			alert("Failed to create trigger");
			return false;
		}
	};

	const handleUpdateTrigger = async (
		name: string,
		description: string,
		cron: string,
		data: string,
		enabled: boolean,
	) => {
		if (!selectedTrigger) return false;
		try {
			const res = await updateTrigger(selectedTrigger.functionId, selectedTrigger.id, {
				name,
				description,
				cron,
				data,
				enabled,
			});
			if (res.status === "OK") {
				loadData();
				return true;
			} else {
				alert(res.message);
				return false;
			}
		} catch (e) {
			alert("Failed to update trigger");
			return false;
		}
	};

	const handleDeleteTrigger = async () => {
		if (!selectedTrigger) return false;
		try {
			const res = await deleteTrigger(selectedTrigger.functionId, selectedTrigger.id);
			if (res.status === "OK") {
				loadData();
				return true;
			} else {
				alert(res.message);
				return false;
			}
		} catch (e) {
			alert("Failed to delete trigger");
			return false;
		}
	};

	return (
		<div className="min-h-screen bg-background">
			{/* Hero Header */}
			<div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20">
				<div className="max-w-6xl mx-auto px-4 py-16">
					<div className="text-center space-y-4">
						<h1 className="text-5xl font-bold text-primary mb-4">Cron Job Manager</h1>
						<div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
						<p className="text-xl text-text/70 max-w-2xl mx-auto">
							Monitor and manage all your scheduled function triggers in one place.
						</p>
					</div>
				</div>
			</div>

			<div className="max-w-6xl mx-auto px-4 py-12">
				<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-8">
					<div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
						<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
							<span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
								⏰
							</span>
							Active Cron Jobs
						</h2>
						<div className="flex items-center gap-3">
							<button
								className="px-4 py-2 bg-primary text-background rounded-xl text-sm font-bold hover:scale-105 transition-all duration-300 flex items-center gap-2"
								onClick={() => setShowCreateModal(true)}
							>
								<span>➕</span> Create Trigger
							</button>
							<ActionButton
								icon="🔄"
								label="Refresh"
								variant="secondary"
								onClick={loadData}
							/>
						</div>
					</div>

					{loading ? (
						<div className="text-center py-12">
							<div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
							<p className="text-text/70 text-lg">Loading your cron jobs...</p>
						</div>
					) : error ? (
						<div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-center">
							{error}
						</div>
					) : triggers.length === 0 ? (
						<div className="text-center py-16 bg-background/30 rounded-xl border border-dashed border-primary/20">
							<div className="text-5xl mb-4">🌙</div>
							<p className="text-text/60 text-lg">No cron jobs found.</p>
							<p className="text-text/40 text-sm mt-2">Click "Create Trigger" to get started.</p>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full">
								<thead>
									<tr className="bg-background/40 border-b border-primary/10">
										<th className="px-6 py-4 text-left text-xs font-bold text-text/50 uppercase tracking-wider">Status</th>
										<th className="px-6 py-4 text-left text-xs font-bold text-text/50 uppercase tracking-wider">Name / Function</th>
										<th className="px-6 py-4 text-left text-xs font-bold text-text/50 uppercase tracking-wider">Schedule (Cron)</th>
										<th className="px-6 py-4 text-left text-xs font-bold text-text/50 uppercase tracking-wider">Next Run</th>
										<th className="px-6 py-4 text-right text-xs font-bold text-text/50 uppercase tracking-wider">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-primary/5">
									{triggers.map((trigger) => (
										<tr
											key={trigger.id}
											className="hover:bg-primary/5 transition-all duration-200 group"
										>
											<td className="px-6 py-4 whitespace-nowrap">
												<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
													trigger.enabled 
														? "bg-green-500/20 text-green-400 border border-green-500/30" 
														: "bg-red-500/20 text-red-400 border border-red-500/30"
												}`}>
													{trigger.enabled ? "Active" : "Disabled"}
												</span>
											</td>
											<td className="px-6 py-4">
												<div className="text-sm font-semibold text-primary">{trigger.name}</div>
												<Link 
													to={`/functions/${trigger.functionId}`}
													className="text-xs text-text/50 flex items-center gap-1 mt-0.5 hover:text-primary transition-colors"
												>
													<span className="opacity-70">ƒ</span> {trigger.function.name}
												</Link>
											</td>
											<td className="px-6 py-4 whitespace-nowrap">
												<code className="px-2 py-1 bg-background/50 rounded border border-primary/10 text-xs text-blue-300 font-mono">
													{trigger.cron}
												</code>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-sm text-text/70">
												{trigger.nextRun ? (
													<div className="flex flex-col">
														<span>{new Date(trigger.nextRun).toLocaleDateString()}</span>
														<span className="text-xs opacity-50">{new Date(trigger.nextRun).toLocaleTimeString()}</span>
													</div>
												) : (
													<span className="text-text/30 italic">Not scheduled</span>
												)}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
												<div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
													<button
														className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all duration-300"
														title="Edit Trigger"
														onClick={() => {
															setSelectedTrigger(trigger);
															setShowEditModal(true);
														}}
													>
														✏️
													</button>
													<button
														className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300"
														title="Delete Trigger"
														onClick={() => {
															setSelectedTrigger(trigger);
															setShowDeleteModal(true);
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
					)}
				</div>
			</div>

			{showCreateModal && (
				<CreateTriggerModal
					isOpen={showCreateModal}
					onClose={() => setShowCreateModal(false)}
					onCreate={handleCreateTrigger}
					functions={functions}
				/>
			)}

			{selectedTrigger && (
				<>
					<EditTriggerModal
						isOpen={showEditModal}
						onClose={() => {
							setShowEditModal(false);
							setSelectedTrigger(null);
						}}
						onUpdate={handleUpdateTrigger}
						trigger={selectedTrigger}
					/>
					<DeleteTriggerModal
						isOpen={showDeleteModal}
						onClose={() => {
							setShowDeleteModal(false);
							setSelectedTrigger(null);
						}}
						onDelete={handleDeleteTrigger}
						triggerName={selectedTrigger.name}
					/>
				</>
			)}
		</div>
	);
}

export default CronJobsPage;
