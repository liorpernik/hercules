import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type PersonalTask = {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'scheduled' | 'completed';
    estimated_duration: string;
};

export default function PersonalTasksPage() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<PersonalTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskDuration, setNewTaskDuration] = useState('1h');

    const fetchTasks = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:8080/api/tasks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (e) {
            console.error("Failed to fetch tasks", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:8080/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newTaskTitle,
                    description: newTaskDesc,
                    estimated_duration: newTaskDuration
                })
            });

            if (res.ok) {
                setNewTaskTitle('');
                setNewTaskDesc('');
                fetchTasks(); // Reload
            }
        } catch (e) {
            console.error("Failed to add task", e);
        }
    };

    const toggleTaskStatus = async (task: PersonalTask) => {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:8080/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            // If we wanted to be strict we'd reload or revert on error, but simple toggle is okay
        } catch (e) {
            console.error("Failed to toggle task", e);
        }
    };

    const deleteTask = async (id: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:8080/api/tasks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (e) {
            console.error("Failed to delete task", e);
        }
    };

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">

            {/* Main Content Area - Split View */}
            <div className="flex-1 flex flex-row overflow-hidden relative">

                {/* LEFT PANEL: Header & Add Form */}
                <div className="w-[30%] min-w-[350px] border-r border-border/50 bg-card/60 p-8 flex flex-col gap-8 z-10">
                    <header>
                        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600 mb-2">
                            Personal Tasks
                        </h1>
                        <p className="text-muted-foreground">Manage your priorities for Hercules.</p>
                    </header>

                    {/* Add Task Form - Expandable Card */}
                    <div className="group bg-card border border-border rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/50 focus-within:shadow-xl focus-within:border-primary/50">
                        <form onSubmit={handleAddTask} className="flex flex-col gap-0">
                            <div className="relative">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block group-hover:text-primary transition-colors">
                                    New Task
                                </label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-muted-foreground/50 py-2"
                                    placeholder="What needs to be done?"
                                    required
                                />
                            </div>

                            {/* Expandable Options */}
                            <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] transition-all duration-300 ease-in-out opacity-50 group-hover:opacity-100 group-focus-within:opacity-100">
                                <div className="overflow-hidden space-y-4 pt-0 group-hover:pt-4 group-focus-within:pt-4 border-t border-transparent group-hover:border-border/50 group-focus-within:border-border/50 mt-0 group-hover:mt-2 group-focus-within:mt-2">
                                    <textarea
                                        value={newTaskDesc}
                                        onChange={e => setNewTaskDesc(e.target.value)}
                                        className="w-full bg-muted/40 border border-border rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary/20 h-24 resize-none text-sm transition-all"
                                        placeholder="Add details, links, or context..."
                                    />

                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Est. Duration</label>
                                            <select
                                                value={newTaskDuration}
                                                onChange={e => setNewTaskDuration(e.target.value)}
                                                className="w-full bg-muted/40 border border-border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="15m">15m</option>
                                                <option value="30m">30m</option>
                                                <option value="45m">45m</option>
                                                <option value="1h">1h</option>
                                                <option value="1.5h">1.5h</option>
                                                <option value="2h">2h</option>
                                                <option value="3h">3h</option>
                                                <option value="4h+">4h+</option>
                                            </select>
                                        </div>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:scale-[1.02] mt-5"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Hint Text */}
                    <div className="mt-auto p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 leading-relaxed">
                        <strong>Tip:</strong> Hercules will see these tasks when you next ask to <em>"Plan my week"</em> and will suggest slots for them.
                    </div>
                </div>

                {/* RIGHT PANEL: Task Grid */}
                <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-background to-muted/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 max-w-5xl mx-auto">
                        {isLoading ? (
                            <div className="col-span-full text-center py-20 text-muted-foreground animate-pulse">
                                Loading tasks...
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="col-span-full border-2 border-dashed border-border rounded-2xl h-96 flex flex-col items-center justify-center text-muted-foreground">
                                <span className="text-4xl mb-4">✨</span>
                                <p className="text-lg">Your queue is empty.</p>
                                <p className="text-sm">Add a task on the left to get started.</p>
                            </div>
                        ) : (
                            [...tasks].sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0)).map(task => (
                                <div key={task.id} className={`group relative p-5 rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col gap-2 ${task.status === 'completed' ? 'bg-muted/30 border-border/50 opacity-60' : 'bg-card border-border hover:border-primary/30'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                            <input
                                                type="checkbox"
                                                checked={task.status === 'completed'}
                                                onChange={() => toggleTaskStatus(task)}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/50 cursor-pointer flex-shrink-0 transition-all"
                                            />
                                            <h3 className={`font-bold text-lg truncate w-full ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                {task.title}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-all"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>

                                    {task.description && (
                                        <p className={`text-sm ml-8 line-clamp-2 ${task.status === 'completed' ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                                            {task.description}
                                        </p>
                                    )}

                                    <div className="ml-8 mt-1 flex items-center gap-2">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${task.status === 'completed' ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                                            ⏱ {task.estimated_duration}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar (Consistent) */}
            <aside className="w-16 hover:w-56 transition-all duration-300 ease-in-out border-l border-border bg-card/80 backdrop-blur-md flex flex-col items-center py-6 gap-6 z-30 shadow-2xl group overflow-hidden">
                <div className="flex flex-col w-full px-2 gap-2">
                    <SidebarButton onClick={() => navigate('/hercules')} icon="🤖" label="Assistant" />
                    <SidebarButton onClick={() => navigate('/')} icon="🏠" label="Home" />
                </div>
                <div className="flex-1" />
                <div className="w-full px-4 border-t border-border/50 pt-4 mt-2">
                    <SidebarButton
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            navigate('/login');
                        }}
                        icon="🚪"
                        label="Sign Out"
                    />
                </div>
            </aside>
        </div>
    );
}

function SidebarButton({ icon, label, onClick }: { icon: string, label: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center w-full p-3 rounded-xl transition-all group/btn hover:bg-muted/50 text-foreground"
            title={label}
        >
            <span className="text-2xl mr-4 min-w-[24px] flex justify-center">{icon}</span>
            <span className="font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 origin-left delay-75">
                {label}
            </span>
        </button>
    );
}
