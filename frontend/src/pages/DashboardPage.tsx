import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Case } from '../types';
import { fetchCases, fetchUsers } from '../api'; // Added fetchUsers

export default function Dashboard() {
    const navigate = useNavigate();
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'mine' | 'user'>('all'); // Added 'user' filter
    const [selectedUserId, setSelectedUserId] = useState<string>(''); // For Partner filter
    const [allUsers, setAllUsers] = useState<any[]>([]); // To populate dropdown
    const [selectedCase, setSelectedCase] = useState<Case | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Case>>({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newCaseForm, setNewCaseForm] = useState({
        title: '',
        status: 'new',
        clientProfile: '',
        leadAttorney: ''
    });

    const handleCreateCase = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:8080/api/cases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newCaseForm)
            });

            if (res.ok) {
                alert('Case created successfully');
                setIsAddModalOpen(false);
                setNewCaseForm({ title: '', status: 'new', clientProfile: '', leadAttorney: '' });
                window.location.reload();
            } else {
                const err = await res.json();
                alert('Failed to create case: ' + (err.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Error creating case');
        }
    };

    // Reset edit state when selection changes
    useEffect(() => {
        if (selectedCase) {
            setEditForm(selectedCase);
            setIsEditing(false);
        }
    }, [selectedCase]);

    const handleSave = async () => {
        if (!selectedCase || !editForm) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:8080/api/cases/${selectedCase.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });

            if (res.ok) {
                const updated = await res.json();
                // Update local state
                setCases(prev => prev.map(c => c.id === updated.id ? { ...c, ...editForm } : c)); // Optimistic or loose update
                setSelectedCase({ ...selectedCase, ...editForm } as Case);
                setIsEditing(false);
                alert('Case updated successfully');
                window.location.reload(); // Reload to ensure full sync
            } else {
                alert('Failed to update case');
            }
        } catch (err) {
            console.error(err);
            alert('Error updating case');
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                // Load user from local storage
                let user = null;
                const userJson = localStorage.getItem('user');
                if (userJson) {
                    user = JSON.parse(userJson);
                    setCurrentUser(user);
                }

                // Handle Google Calendar OAuth callback: token is in the URL hash fragment
                // (e.g. #auth=success&token=...&email=...) to avoid logging it in server access logs.
                if (window.location.hash) {
                    const hashParams = new URLSearchParams(window.location.hash.slice(1));
                    const authStatus = hashParams.get('auth');
                    const newToken = hashParams.get('token');
                    const newEmail = hashParams.get('email');
                    if (authStatus === 'success' && newToken) {
                        localStorage.setItem('token', newToken);
                        if (newEmail) {
                            const existing = localStorage.getItem('user');
                            const parsed = existing ? JSON.parse(existing) : {};
                            localStorage.setItem('user', JSON.stringify({ ...parsed, email: newEmail }));
                        }
                        // Remove the fragment from the URL without triggering a reload.
                        window.history.replaceState(null, '', window.location.pathname);
                    }
                }

                const caseData = await fetchCases();
                setCases(caseData);

                // Fetch Users if Partner/Admin
                if (user && (user.role === 'admin' || user.role === 'partner')) {
                    const userData = await fetchUsers();
                    setAllUsers(userData);
                }

                // ... (Deep link logic omitted)

                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const sortedCases = useMemo(() => {
        let filtered = cases;
        if (filter === 'mine' && currentUser) {
            filtered = cases.filter(c => c.assigned_user_id === currentUser.id);
        } else if (filter === 'user' && selectedUserId) {
            filtered = cases.filter(c => c.assigned_user_id === selectedUserId);
        }
        return [...filtered].sort((a, b) => b.priorityScore - a.priorityScore);
    }, [cases, filter, currentUser, selectedUserId]);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading cases...</div>;
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-600 font-bold mb-2">Error loading cases</div>
                <div className="text-slate-600 bg-slate-100 p-4 rounded inline-block">
                    {error}
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="block mx-auto mt-4 text-indigo-600 hover:text-indigo-800"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-muted to-accent transition-colors duration-500 p-8">
            {/* Background Blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse pointer-events-none delay-1000" />

            <div className="max-w-7xl mx-auto relative z-10">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-purple-600 text-transparent bg-clip-text tracking-tight pb-2">
                            MyHercules (TM) Dashboard
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Prioritized Case View
                        </p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex space-x-2">
                            <label className="cursor-pointer glass text-slate-700 dark:text-slate-200 hover:text-indigo-500 border border-white/20 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center">
                                <span>📥 Import</span>
                                <input
                                    type="file"
                                    accept=".xlsx"
                                    className="hidden"
                                    onChange={async (e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0];
                                            const formData = new FormData();
                                            formData.append('file', file);

                                            try {
                                                const token = localStorage.getItem('token');
                                                const res = await fetch('http://localhost:8080/api/cases/import', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Authorization': `Bearer ${token}`
                                                    },
                                                    body: formData
                                                });
                                                const data = await res.json();
                                                if (res.ok) {
                                                    let msg = `Import result: ${data.imported} imported, ${data.skipped} skipped.`;
                                                    if (data.skipped_details && data.skipped_details.length > 0) {
                                                        const lines = data.skipped_details.map((d: any) => d.line).join(', ');
                                                        msg += `\n\nSkipped Lines: ${lines}`;
                                                    }
                                                    if (data.inconsistencies?.length > 0) {
                                                        msg += `\n${data.inconsistencies.length} inconsistencies found.`;
                                                    }
                                                    alert(msg);
                                                    window.location.reload();
                                                } else {
                                                    alert('Import failed: ' + data.error);
                                                }
                                            } catch (err) {
                                                alert('Error uploading file');
                                                console.error(err);
                                            }
                                            // Reset input
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </label>
                            <button
                                onClick={() => {
                                    const token = localStorage.getItem('token');
                                    fetch('http://localhost:8080/api/cases/export', {
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    })
                                        .then(res => res.blob())
                                        .then(blob => {
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = 'cases_export.xlsx';
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                        })
                                        .catch(err => alert('Export failed'));
                                }}
                                className="glass text-slate-700 dark:text-slate-200 hover:text-indigo-500 border border-white/20 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center"
                            >
                                📤 Export
                            </button>
                        </div>

                        <div className="glass border border-white/20 rounded-lg p-1 flex">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-primary/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                All Cases
                            </button>
                            <button
                                onClick={() => { setFilter('mine'); setSelectedUserId(''); }}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'mine' ? 'bg-primary/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                My Cases
                            </button>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'partner') && (
                                <select
                                    className="bg-transparent text-slate-600 dark:text-slate-400 text-sm font-medium px-2 py-1.5 focus:outline-none cursor-pointer"
                                    value={selectedUserId}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setFilter('user');
                                            setSelectedUserId(e.target.value);
                                        } else {
                                            setFilter('all');
                                            setSelectedUserId('');
                                        }
                                    }}
                                >
                                    <option value="">Filter by User...</option>
                                    {allUsers.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.full_name || u.name || u.email}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center shadow-lg shadow-indigo-500/30"
                        >
                            <span className="mr-2">+</span> New Case
                        </button>
                        <button
                            onClick={() => navigate('/hercules')}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                        >
                            ← Back to Hercules
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    {/* New Cases Column */}
                    <section className="glass-card rounded-xl p-6">
                        <h2 className="text-xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400 flex items-center">
                            <span className="w-3 h-3 bg-indigo-500 rounded-full mr-2 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                            New Cases
                        </h2>
                        <div className="space-y-4">
                            {sortedCases.filter(c => c.status === 'new').map(c => (
                                <CaseCard key={c.id} c={c} onClick={() => setSelectedCase(c)} />
                            ))}
                            {sortedCases.filter(c => c.status === 'new').length === 0 && (
                                <p className="text-slate-400 text-sm italic">No new cases found.</p>
                            )}
                        </div>
                    </section>

                    {/* Ongoing Cases Column */}
                    <section className="glass-card rounded-xl p-6">
                        <h2 className="text-xl font-semibold mb-4 text-emerald-600 dark:text-emerald-400 flex items-center">
                            <span className="w-3 h-3 bg-emerald-500 rounded-full mr-2 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                            Ongoing Cases
                        </h2>
                        <div className="space-y-4">
                            {sortedCases.filter(c => c.status === 'ongoing').map(c => (
                                <CaseCard key={c.id} c={c} onClick={() => setSelectedCase(c)} />
                            ))}
                            {sortedCases.filter(c => c.status === 'ongoing').length === 0 && (
                                <p className="text-slate-400 text-sm italic">No ongoing cases found.</p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Add Case Modal */}
                {isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6">
                            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Add New Case</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Case Title</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newCaseForm.title}
                                        onChange={e => setNewCaseForm({ ...newCaseForm, title: e.target.value })}
                                        placeholder="e.g. Smith v. Jones"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client Profile / Description</label>
                                    <textarea
                                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                                        value={newCaseForm.clientProfile}
                                        onChange={e => setNewCaseForm({ ...newCaseForm, clientProfile: e.target.value })}
                                        placeholder="Brief description of the client and case..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                        <select
                                            className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            value={newCaseForm.status}
                                            onChange={e => setNewCaseForm({ ...newCaseForm, status: e.target.value })}
                                        >
                                            <option value="new">New</option>
                                            <option value="ongoing">Ongoing</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lead Attorney</label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            value={newCaseForm.leadAttorney}
                                            onChange={e => setNewCaseForm({ ...newCaseForm, leadAttorney: e.target.value })}
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCase}
                                    className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium"
                                >
                                    Create Case
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Case Details Modal */}
                {selectedCase && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedCase(null)}>
                        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                                <h2 className="text-2xl font-bold text-slate-900">{selectedCase.title}</h2>
                                <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Edit Mode Toggle Header */}
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                                        {isEditing ? 'Editing Case Details' : 'Case Information'}
                                    </h3>
                                    {!isEditing && (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                        >
                                            ✏️ Edit Details
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Left Column */}
                                    <div className="space-y-4">
                                        <DetailField label="Phase" value={selectedCase.phase} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, phase: val }))} bindValue={editForm.phase} />

                                        <DetailField label="Charges" value={selectedCase.charges} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, charges: val }))} bindValue={editForm.charges} />

                                        <DetailField label="Next Court Date" value={selectedCase.nextCourtDate} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, nextCourtDate: val }))} bindValue={editForm.nextCourtDate} />

                                        <DetailField label="Last Hearing" value={selectedCase.lastHearing} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, lastHearing: val }))} bindValue={editForm.lastHearing} />

                                        <DetailField label="Jail Visit" value={selectedCase.jailVisit} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, jailVisit: val }))} bindValue={editForm.jailVisit} />
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-4">
                                        <DetailField label="Jurisdiction" value={selectedCase.jurisdiction} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, jurisdiction: val }))} bindValue={editForm.jurisdiction} />

                                        <DetailField label="Lead Attorney" value={selectedCase.leadAttorney || selectedCase.assignedUser} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, leadAttorney: val }))} bindValue={editForm.leadAttorney} />

                                        <DetailField label="Client Profile" value={selectedCase.clientProfile} isEditing={isEditing} multiline
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, clientProfile: val }))} bindValue={editForm.clientProfile} />

                                        <DetailField label="Pending Actions" value={selectedCase.pendingActions} isEditing={isEditing} multiline
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, pendingActions: val }))} bindValue={editForm.pendingActions} />

                                        <DetailField label="Last Interaction" value={selectedCase.lastInteraction} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, lastInteraction: val }))} bindValue={editForm.lastInteraction} />
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-700 my-4 pt-4">
                                    <h4 className="font-medium text-slate-900 dark:text-slate-200 mb-4">Financials & Status</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <DetailField label="Balance Due" value={selectedCase.balanceDue?.toString()} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, balanceDue: parseFloat(val) || 0 }))} bindValue={editForm.balanceDue?.toString()} />

                                        <DetailField label="Past Due Amount" value={selectedCase.pastDueAmount?.toString()} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, pastDueAmount: parseFloat(val) || 0 }))} bindValue={editForm.pastDueAmount?.toString()} />

                                        <DetailField label="Current/Past Due" value={selectedCase.currentOrPastDue} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, currentOrPastDue: val }))} bindValue={editForm.currentOrPastDue} />

                                        <DetailField label="Last Payment Date" value={selectedCase.lastPaymentDate ? new Date(selectedCase.lastPaymentDate).toLocaleDateString() : ''} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, lastPaymentDate: val }))} bindValue={editForm.lastPaymentDate} />

                                        <DetailField label="Last Payment Amt" value={selectedCase.lastPaymentAmount?.toString()} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, lastPaymentAmount: parseFloat(val) || 0 }))} bindValue={editForm.lastPaymentAmount?.toString()} />

                                        <DetailField label="Status" value={selectedCase.status} isEditing={isEditing}
                                            onChange={(val: any) => setEditForm(prev => ({ ...prev, status: val as any }))} bindValue={editForm.status}
                                            options={['new', 'ongoing', 'closed']} />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                                    {isEditing ? (
                                        <>
                                            <button className="px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg font-medium" onClick={() => setIsEditing(false)}>
                                                Cancel
                                            </button>
                                            <button className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium" onClick={handleSave}>
                                                💾 Save Changes
                                            </button>
                                        </>
                                    ) : (
                                        <button className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium" onClick={() => setSelectedCase(null)}>
                                            Close
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper component for fields
function DetailField({ label, value, isEditing, onChange, bindValue, multiline, options }: any) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
            {isEditing ? (
                options ? (
                    <select
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900"
                        value={bindValue || ''}
                        onChange={e => onChange(e.target.value)}
                    >
                        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : multiline ? (
                    <textarea
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 h-24"
                        value={bindValue || ''}
                        onChange={e => onChange(e.target.value)}
                    />
                ) : (
                    <input
                        type="text"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900"
                        value={bindValue || ''}
                        onChange={e => onChange(e.target.value)}
                    />
                )
            ) : (
                <div className="text-slate-900 dark:text-slate-200 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-transparent dark:border-slate-700">
                    {value || <span className="text-slate-400 italic">Empty</span>}
                </div>
            )}
        </div>
    );
}

function CaseCard({ c, onClick }: { c: Case, onClick: () => void }) {
    return (
        <div onClick={onClick} className="p-4 border border-border/40 bg-white/5 dark:bg-black/20 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors cursor-pointer group backdrop-blur-sm">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-slate-900 dark:text-slate-100">{c.title}</h3>
                <span className={`px-2 py-1 rounded text-xs font-bold ${c.priorityScore > 80 ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                    c.priorityScore > 50 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                    }`}>
                    Score: {c.priorityScore}
                </span>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 flex justify-between">
                <span>{c.deadline ? `Due: ${c.deadline}` : 'No deadline'}</span>
                {c.assignedUser && <span className="text-slate-700 dark:text-slate-300">👤 {c.assignedUser}</span>}
            </div>
        </div>
    );
}
