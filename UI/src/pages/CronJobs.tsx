import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
	listAllTriggers,
	deleteTrigger,
	updateTrigger,
	createTrigger,
	runTrigger,
} from "../services/backend.triggers";
import { getFunctions } from "../services/backend.functions";
import { Trigger, XFunction } from "../types/Prisma";
import EditTriggerModal from "../components/modals/functionTriggers/EditTriggerModal";
import DeleteTriggerModal from "../components/modals/functionTriggers/DeleteTriggerModal";
import CreateTriggerModal from "../components/modals/functionTriggers/CreateTriggerModal";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";

const formatDateTime = (dateValue: string | null) => {
	if (!dateValue) return null;
	const d = new Date(dateValue);
	if (Number.isNaN(d.getTime())) return null;
	return { date: d.toLocaleDateString(), time: d.toLocaleTimeString() };
};

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
			const [triggerRes, functionRes] = await Promise.all([listAllTriggers(), getFunctions(true)]);
			if (triggerRes.status === "OK") setTriggers(triggerRes.data);
			else setError(triggerRes.message || "Failed to load triggers");
			if (functionRes.status === "OK") setFunctions(functionRes.data as unknown as XFunction[]);
		} catch { setError("Failed to load data"); }
		finally { setLoading(false); }
	};

	useEffect(() => { loadData(); }, []);

	const handleCreateTrigger = async (functionId: number, name: string, description: string, cron: string, data: string, enabled: boolean) => {
		try {
			const res = await createTrigger(functionId, { name, description, cron, data, enabled });
			if (res.status === "OK") { loadData(); setShowCreateModal(false); return true; }
			toast.error(res.message);
			return false;
		} catch { toast.error("Failed to create trigger"); return false; }
	};

	const handleUpdateTrigger = async (name: string, description: string, cron: string, data: string, enabled: boolean) => {
		if (!selectedTrigger) return false;
		try {
			const res = await updateTrigger(selectedTrigger.functionId, selectedTrigger.id, { name, description, cron, data, enabled });
			if (res.status === "OK") { loadData(); return true; }
			toast.error(res.message);
			return false;
		} catch { toast.error("Failed to update trigger"); return false; }
	};

	const handleDeleteTrigger = async () => {
		if (!selectedTrigger) return false;
		try {
			const res = await deleteTrigger(selectedTrigger.functionId, selectedTrigger.id);
			if (res.status === "OK") { loadData(); return true; }
			toast.error(res.message);
			return false;
		} catch { toast.error("Failed to delete trigger"); return false; }
	};

	const handleRunTrigger = async (trigger: (Trigger & { function: { name: string } }) | null) => {
		if (!trigger) return false;
		try {
			const res = await runTrigger(trigger.functionId, trigger.id);
			if ((res as any).status === "OK") { toast.success("Trigger executed"); loadData(); return true; }
			toast.error((res as any).message || "Failed to run trigger");
			return false;
		} catch { toast.error("Failed to run trigger"); return false; }
	};

	return (
		<div>
			{/* Page header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-text">Cron Jobs</h1>
					<p className="text-sm text-muted mt-0.5">Scheduled triggers that run your functions automatically</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						className="p-2 text-muted hover:text-text hover:bg-surface rounded-lg transition-colors"
						onClick={loadData}
						title="Refresh"
					>
						<Icon name="arrow-path" className="w-4 h-4" />
					</button>
					<button
						className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
						onClick={() => setShowCreateModal(true)}
					>
						<Icon name="plus" className="w-4 h-4" />
						New Trigger
					</button>
				</div>
			</div>

			{/* Content */}
			{loading ? (
				<div className="flex items-center justify-center py-24">
					<div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
				</div>
			) : error ? (
				<div className="bg-surface border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400">{error}</div>
			) : triggers.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-24 text-center">
					<div className="w-12 h-12 rounded-xl bg-surface border border-white/[0.07] flex items-center justify-center mb-4">
						<Icon name="clock" className="w-6 h-6 text-primary/40" />
					</div>
					<h2 className="text-lg font-semibold text-text mb-1">No cron jobs</h2>
					<p className="text-sm text-muted mb-5">Schedule a function to run automatically on a cron expression.</p>
					<button
						className="flex items-center gap-1.5 px-4 py-2 bg-primary text-background text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
						onClick={() => setShowCreateModal(true)}
					>
						<Icon name="plus" className="w-4 h-4" /> Create Trigger
					</button>
				</div>
			) : (
				<div className="bg-surface border border-white/[0.07] rounded-xl overflow-hidden">
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead>
								<tr className="border-b border-white/[0.07]">
									<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Name / Function</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Schedule</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Next Run</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Last Run</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Last Result</th>
									<th className="px-5 py-3 w-28" />
								</tr>
							</thead>
							<tbody className="divide-y divide-white/[0.04]">
								{triggers.map((trigger) => {
									const nextRun = formatDateTime(trigger.nextRun);
									const lastRun = formatDateTime(trigger.lastRun);
									return (
										<tr key={trigger.id} className="hover:bg-white/[0.02] transition-colors group">
											<td className="px-5 py-3 whitespace-nowrap">
												<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${trigger.enabled ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-white/[0.05] text-muted border-white/[0.07]"}`}>
													{trigger.enabled ? "Active" : "Disabled"}
												</span>
											</td>
											<td className="px-5 py-3">
												<p className="text-sm font-medium text-text">{trigger.name}</p>
												<Link to={`/functions/${trigger.functionId}`} className="text-xs text-muted hover:text-primary transition-colors">
													{trigger.function.name}
												</Link>
											</td>
											<td className="px-5 py-3 whitespace-nowrap">
												<code className="px-2 py-0.5 bg-background rounded border border-white/[0.07] text-xs text-primary/80 font-mono">
													{trigger.cron}
												</code>
											</td>
											<td className="px-5 py-3 whitespace-nowrap text-xs text-muted">
												{nextRun ? <><p>{nextRun.date}</p><p className="text-muted/50">{nextRun.time}</p></> : <span className="italic">—</span>}
											</td>
											<td className="px-5 py-3 whitespace-nowrap text-xs text-muted">
												{lastRun ? <><p>{lastRun.date}</p><p className="text-muted/50">{lastRun.time}</p></> : <span className="italic">Never</span>}
											</td>
											<td className="px-5 py-3 whitespace-nowrap">
												{trigger.lastRun ? (
													trigger.lastRunSuccessful === true ? (
														<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">OK</span>
													) : trigger.lastRunSuccessful === false ? (
														<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Failed</span>
													) : (
														<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Unknown</span>
													)
												) : (
													<span className="text-muted/40 text-xs italic">—</span>
												)}
											</td>
											<td className="px-5 py-3 whitespace-nowrap">
												<div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<button className="p-1.5 text-muted hover:text-green-400 hover:bg-green-500/10 rounded transition-colors" title="Run now" onClick={() => handleRunTrigger(trigger)}>
														<Icon name="play" className="w-3.5 h-3.5" />
													</button>
													<button className="p-1.5 text-muted hover:text-text hover:bg-white/[0.06] rounded transition-colors" title="Edit" onClick={() => { setSelectedTrigger(trigger); setShowEditModal(true); }}>
														<Icon name="pencil" className="w-3.5 h-3.5" />
													</button>
													<button className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete" onClick={() => { setSelectedTrigger(trigger); setShowDeleteModal(true); }}>
														<Icon name="trash" className="w-3.5 h-3.5" />
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{showCreateModal && (
				<CreateTriggerModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreateTrigger} functions={functions} />
			)}
			{selectedTrigger && (
				<>
					<EditTriggerModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedTrigger(null); }} onUpdate={handleUpdateTrigger} onRun={() => handleRunTrigger(selectedTrigger)} trigger={selectedTrigger} />
					<DeleteTriggerModal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedTrigger(null); }} onDelete={handleDeleteTrigger} triggerName={selectedTrigger.name} />
				</>
			)}
		</div>
	);
}

export default CronJobsPage;
