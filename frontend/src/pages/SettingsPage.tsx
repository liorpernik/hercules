import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
    id: string;
    email: string;
    role: string;
    full_name?: string; // Updated to match backend
    name?: string;      // Backwards compatibility/legacy
    location?: string;
    seniority_level?: string;
}

export default function Settings() {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'admin'>('profile');

    useEffect(() => {
        const fetchMe = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const res = await fetch('http://localhost:8080/api/users/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const realUser = await res.json();
                    setCurrentUser(realUser);
                    localStorage.setItem('user', JSON.stringify(realUser));
                } else {
                    // Fallback to local storage or logout if token invalid
                    const userJson = localStorage.getItem('user');
                    if (userJson) setCurrentUser(JSON.parse(userJson));
                    else navigate('/login');
                }
            } catch (e) {
                const userJson = localStorage.getItem('user');
                if (userJson) setCurrentUser(JSON.parse(userJson));
            }
        };

        fetchMe();
    }, [navigate]);

    if (!currentUser) return null;

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-muted to-accent transition-colors duration-500 p-8">
            {/* Background Blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse pointer-events-none delay-1000" />

            <div className="max-w-4xl mx-auto relative z-10">
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-purple-600 text-transparent bg-clip-text">Settings</h1>
                    <button onClick={() => navigate('/dashboard')} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">← Back to Dashboard</button>
                </header>

                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="flex border-b border-border/50">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`px-6 py-4 font-medium text-sm transition-colors ${activeTab === 'profile' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
                        >
                            My Profile
                        </button>
                        {currentUser.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('admin')}
                                className={`px-6 py-4 font-medium text-sm transition-colors ${activeTab === 'admin' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
                            >
                                User Management (Admin)
                            </button>
                        )}
                    </div>

                    <div className="p-8 text-foreground">
                        {activeTab === 'profile' ? <ProfileSettings user={currentUser} /> : <AdminSettings />}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProfileSettings({ user }: { user: User }) {
    const [fullName, setFullName] = useState(user.full_name || user.name || '');
    const [location, setLocation] = useState(user.location || '');
    const [seniority, setSeniority] = useState(user.seniority_level || '');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const handleSave = async () => {
        setSaving(true);
        setMsg('');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:8080/api/users/${user.id}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ location, seniority_level: seniority, full_name: fullName })
            });
            if (res.ok) {
                setMsg('✅ Profile updated successfully');
                // Update local storage
                const updated = { ...user, location, seniority_level: seniority, full_name: fullName };
                localStorage.setItem('user', JSON.stringify(updated));
            } else {
                setMsg('❌ Failed to update profile');
            }
        } catch (e) {
            setMsg('❌ Error saving profile');
        } finally {
            setSaving(false);
        }
    };

    const isNameEditable = !user.full_name && !user.name;

    return (
        <div className="max-w-lg space-y-6">
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name {isNameEditable ? '(Required)' : '(from Google)'}</label>
                <input
                    type="text"
                    value={fullName}
                    onChange={(e) => isNameEditable && setFullName(e.target.value)}
                    disabled={!isNameEditable}
                    className={`w-full border border-border rounded px-3 py-2 transition-all ${!isNameEditable ? 'bg-muted/50 text-muted-foreground cursor-not-allowed' : 'bg-background/50 text-foreground focus:ring-2 focus:ring-primary focus:border-primary'}`}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                <input type="text" value={user.email} disabled className="w-full bg-muted/50 border border-border rounded px-3 py-2 text-muted-foreground cursor-not-allowed" />
            </div>
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Location / Office</label>
                <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. New York, London"
                    className="w-full bg-background/50 border border-border rounded px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none focus:border-primary transition-all"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Seniority Level</label>
                <select
                    value={seniority}
                    onChange={e => setSeniority(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none focus:border-primary transition-all"
                >
                    <option value="">Select Level...</option>
                    <option value="Junior Associate">Junior Associate</option>
                    <option value="Senior Associate">Senior Associate</option>
                    <option value="Partner">Partner</option>
                    <option value="Paralegal">Paralegal</option>
                </select>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
                {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {msg && <span className="ml-4 text-sm font-medium">{msg}</span>}
        </div>
    );
}

function AdminSettings() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:8080/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setUsers(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const updateRole = async (id: string, newRole: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:8080/api/users/${id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u));
            } else {
                alert("Failed to update user role");
            }
        } catch (e) {
            alert("Error updating role");
        }
    };

    if (loading) return <div>Loading users...</div>;

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">User Management</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="py-3 px-4 font-semibold text-slate-600">Email</th>
                            <th className="py-3 px-4 font-semibold text-slate-600">Name</th>
                            <th className="py-3 px-4 font-semibold text-slate-600">Location</th>
                            <th className="py-3 px-4 font-semibold text-slate-600">Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-4 text-slate-800">{u.email}</td>
                                <td className="py-3 px-4 text-slate-800">{u.full_name || u.name || '-'}</td>
                                <td className="py-3 px-4 text-slate-600">{u.location || '-'}</td>
                                <td className="py-3 px-4">
                                    <select
                                        value={u.role}
                                        onChange={(e) => updateRole(u.id, e.target.value)}
                                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2"
                                    >
                                        <option value="lawyer">Lawyer</option>
                                        <option value="admin">Admin</option>
                                        <option value="partner">Partner</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
