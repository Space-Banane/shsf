import { useEffect, useState } from "react";
import {
listGuestUsers,
GuestUser,
getFunctionNamesForGuest,
} from "../services/backend.guest";
import CreateGuestModal from "../components/modals/CreateGuestModal";
import UpdateGuestModal from "../components/modals/UpdateGuestModal";
import DeleteGuestModal from "../components/modals/DeleteGuestModal";
import ClearGuestSessionsModal from "../components/modals/ClearGuestSessionsModal";

export default function GuestUsersPage() {
const [guests, setGuests] = useState<GuestUser[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const [selectedGuest, setSelectedGuest] = useState<GuestUser | null>(null);
const [functionNames, setFunctionNames] = useState<string[]>([]);
const [itemLoading, setItemLoading] = useState(false);
const [itemError, setItemError] = useState("");

const [showCreateModal, setShowCreateModal] = useState(false);
const [showUpdateModal, setShowUpdateModal] = useState(false);
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [showClearModal, setShowClearModal] = useState(false);
const [targetGuest, setTargetGuest] = useState<GuestUser | null>(null);

// Load all guests
const fetchGuests = async () => {
setLoading(true);
setError(null);
try {
const res = await listGuestUsers();
const guestsArr =
(res as any).guests ??
((res as any).data && (res as any).data.guests) ??
[];
if (Array.isArray(guestsArr)) {
setGuests(guestsArr);
// Update selectedGuest if it's currently selected
if (selectedGuest) {
const updated = guestsArr.find(g => g.id === selectedGuest.id);
if (updated) setSelectedGuest(updated);
}
} else {
setError(res.error || "Failed to load guests");
}
} catch {
setError("Failed to load guests");
} finally {
setLoading(false);
}
};

// Load function names for selected guest
const loadGuestDetails = async (guest: GuestUser) => {
setItemLoading(true);
setItemError("");
try {
if (guest.permittedFunctions && guest.permittedFunctions.length > 0) {
const res = await getFunctionNamesForGuest(guest.permittedFunctions);
let names: string[] = [];
if (res.status === "OK") {
if (Array.isArray((res as any).data)) {
names = (res as any).data;
} else if ((res as any).data && Array.isArray((res as any).data.data)) {
names = (res as any).data.data;
}
setFunctionNames(names);
} else {
setItemError("Failed to load permitted functions");
}
} else {
setFunctionNames([]);
}
} catch {
setItemError("Failed to load guest details");
} finally {
setItemLoading(false);
}
};

useEffect(() => {
fetchGuests();
}, []);

useEffect(() => {
if (selectedGuest) {
loadGuestDetails(selectedGuest);
} else {
setFunctionNames([]);
}
}, [selectedGuest]);

return (
<div className="min-h-screen bg-background">
{/* Hero Header */}
<div className="relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-b border-primary/20">
<div className="max-w-6xl mx-auto px-4 py-16">
<div className="text-center space-y-4">
<h1 className="text-5xl font-bold text-primary mb-4">Guest Users</h1>
<div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
<p className="text-xl text-text/70 max-w-2xl mx-auto">
Manage guest accounts and their access to your serverless functions.
</p>
</div>
</div>
</div>

<div className="max-w-6xl mx-auto px-4 py-12">
{selectedGuest ? (
<div className="max-w-3xl mx-auto">
<button
className="mb-6 flex items-center gap-2 text-primary font-semibold hover:underline hover:scale-105 transition-all duration-200"
onClick={() => setSelectedGuest(null)}
>
<span className="text-2xl">←</span> Back to Guest List
</button>
<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-8">
<div className="flex items-center justify-between mb-6">
<div>
<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
<span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
👤
</span>
{selectedGuest.displayName}
</h2>
<div className="text-text/60 text-sm mt-1">
{selectedGuest.email}
</div>
</div>
<div className="flex gap-2">
<button
className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-[0_0_20px_rgba(124,131,253,0.2)] transition-all duration-300"
onClick={() => {
setTargetGuest(selectedGuest);
setShowUpdateModal(true);
}}
>
Edit Profile
</button>
<button
className="px-4 py-2 bg-background/20 border border-primary/10 rounded-lg text-primary hover:border-primary/30 hover:bg-primary/5 font-semibold transition-all duration-300"
onClick={() => {
setTargetGuest(selectedGuest);
setShowClearModal(true);
}}
>
Clear Sessions
</button>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
<div className="bg-background/30 p-4 rounded-xl border border-primary/10">
<div className="text-xs text-text/50 uppercase tracking-wider mb-1">Created At</div>
<div className="text-text font-medium">
{new Date(selectedGuest.createdAt).toLocaleString()}
</div>
</div>
<div className="bg-background/30 p-4 rounded-xl border border-primary/10">
<div className="text-xs text-text/50 uppercase tracking-wider mb-1">Active Sessions</div>
<div className="text-text font-medium">
{selectedGuest.activeSessions ?? 0}
</div>
</div>
</div>

<h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
<span className="text-xl">⚡</span> Permitted Functions
</h3>

{itemLoading ? (
<div className="text-center py-8">
<div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
<p className="text-text/70">Loading permissions...</p>
</div>
) : itemError ? (
<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
{itemError}
</div>
) : !selectedGuest.permittedFunctions || selectedGuest.permittedFunctions.length === 0 ? (
<div className="text-center py-8 text-text/60 bg-background/20 rounded-xl border border-dashed border-primary/20">
No functions assigned to this guest.
</div>
) : (
<div className="grid grid-cols-1 gap-2">
{selectedGuest.permittedFunctions.map((fnId, idx) => (
<a
key={fnId}
href={`/functions/${fnId}?preopen=guests`}
className="flex items-center justify-between p-3 bg-background/30 border border-primary/10 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
>
<span className="font-mono text-primary">
{functionNames[idx] || `Function #${fnId}`}
</span>
<span className="text-xs text-text/40">View Access →</span>
</a>
))}
</div>
)}
<p className="text-xs text-text/40 mt-6 italic bg-primary/5 p-3 rounded-lg border border-primary/10">
Note: To manage function permissions, please visit the specific function's configuration page.
</p>
</div>
</div>
) : (
<div className="flex flex-col items-center">
<div className="w-full max-w-lg space-y-6">
<div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-primary/20 rounded-2xl p-6 shadow-xl">
<div className="flex items-center justify-between mb-6">
<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
<span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
👤
</span>
Guest List
</h2>
<button
className="px-4 py-2 bg-primary text-background rounded-lg font-bold hover:scale-105 transition-all duration-300 shadow-lg shadow-primary/20"
onClick={() => setShowCreateModal(true)}
>
+ New Guest
</button>
</div>
{loading ? (
<div className="text-center py-12">
<div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
<p className="text-text/70 animate-pulse">Fetching guests...</p>
</div>
) : error ? (
<div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
{error}
</div>
) : guests.length === 0 ? (
<div className="text-center py-12 text-text/60 bg-background/20 rounded-xl border border-dashed border-primary/20">
No guest users found.
</div>
) : (
<ul className="space-y-3">
{guests.map((guest) => (
<li key={guest.id}>
<button
className="w-full flex items-center gap-4 p-4 rounded-xl border border-primary/10 bg-background/40 transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:translate-x-1 group"
onClick={() => setSelectedGuest(guest)}
>
<div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
👤
</div>
<div className="flex-1 text-left">
<div className="font-bold text-primary group-hover:text-blue-400 transition-colors">
{guest.displayName}
</div>
<div className="text-xs text-text/60">{guest.email}</div>
</div>
<button
className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-300 hover:scale-110 opacity-0 group-hover:opacity-100"
title="Delete guest"
onClick={(e) => {
e.stopPropagation();
setTargetGuest(guest);
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

<CreateGuestModal
isOpen={showCreateModal}
onClose={() => setShowCreateModal(false)}
onSuccess={fetchGuests}
/>

<UpdateGuestModal
isOpen={showUpdateModal}
onClose={() => {
setShowUpdateModal(false);
setTargetGuest(null);
}}
onSuccess={fetchGuests}
guest={targetGuest}
/>

<DeleteGuestModal
isOpen={showDeleteModal}
onClose={() => {
setShowDeleteModal(false);
setTargetGuest(null);
}}
onSuccess={() => {
if (selectedGuest?.id === targetGuest?.id) setSelectedGuest(null);
fetchGuests();
}}
guest={targetGuest}
/>

<ClearGuestSessionsModal
isOpen={showClearModal}
onClose={() => setShowClearModal(false)}
onSuccess={fetchGuests}
guest={targetGuest}
/>
</div>
);
}
