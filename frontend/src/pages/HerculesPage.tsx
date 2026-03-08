import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Scheduler from '../components/Scheduler';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    text: string;
    action?: string;
    data?: any;
};

interface AssistantProps {
    type?: 'hercules' | 'moneta';
}

export default function Assistant({ type = 'hercules' }: AssistantProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [inputValue, setInputValue] = useState('');
    const [scheduleProposal, setScheduleProposal] = useState<{ data: any[], messageId: number } | null>(null);

    const isMoneta = type === 'moneta';
    const storageKey = isMoneta ? 'chat_history_moneta' : 'chat_history';
    const title = isMoneta ? 'Moneta - Collections' : 'Hercules - Legal Assistant';
    // Removed specific themeColor, relying on global theme

    // Always start in Hero mode (false), unless explicitly overriding
    const [hasStartedChat, setHasStartedChat] = useState(false);

    // Initialize from LocalStorage
    // Helper to get welcome message based on type
    const getWelcomeMessage = (t: 'hercules' | 'moneta') => {
        if (t === 'moneta') {
            return '## **Welcome to Moneta**\n\nI am the **Goddess of Coin and Memory**.\n\n**I specialize in:**\n*   💸 **Compassionate Collections**\n*   🗣️ **Tactical Empathy Scripts**\n*   📉 **Financial Recovery Strategy**\n\n*Who do we need to reach out to today?*';
        }
        return '## **Welcome to Hercules**\n\nI am your **AI Legal Assistant**.\n\n**I can help you with:**\n*   📊 **Prioritizing** urgent cases\n*   📅 **Optimizing** team schedules\n\n*How can I assist you today?*';
    };

    const [messages, setMessages] = useState<Message[]>(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        }

        return [{
            id: 1,
            role: 'assistant',
            text: getWelcomeMessage(type)
        }];
    });

    const [isLoading, setIsLoading] = useState(false);

    // Check if we have history to determine if resume option is available
    const hasHistory = messages.length > 1;

    // Auto-trigger Personal Tasks
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('action') === 'personal-tasks') {
            if (!hasStartedChat) {
                handleCommand("I have personal tasks to organize. Please review my schedule and help me plan them.");
                navigate(location.pathname, { replace: true }); // Clear param
            }
        }
    }, [location]);


    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Save to LocalStorage whenever messages change
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(messages));
    }, [messages, storageKey]);

    // Scroll on new message
    useEffect(() => {
        if (hasStartedChat) {
            scrollToBottom();
        }
    }, [messages, hasStartedChat]);


    const handleCommand = async (cmd: string) => {
        if (!cmd.trim()) return;

        if (!hasStartedChat) setHasStartedChat(true);
        setIsLoading(true);

        // Prepare History for Backend
        // Filter out initial welcome message if it's artificial
        // Map 'assistant' -> 'model'
        const history = messages
            .filter(m => m.id !== 1) // exclude welcome/system message? Or include if relevant? Usually system prompt is separate.
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

        const userMsg: Message = { id: Date.now(), role: 'user', text: cmd };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch("http://localhost:8080/api/ai/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: cmd,
                    assistant_type: type,
                    history: history
                }),
            });

            if (!res.ok) {
                let errorDetails = "Service Unavailable.";
                try {
                    const errData = await res.json();
                    errorDetails = `Error ${res.status}: ${errData.error || res.statusText}`;
                } catch (e) {
                    errorDetails = `Error ${res.status}: ${res.statusText}`;
                }
                setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', text: errorDetails }]);
                return;
            }

            const data = await res.json();

            if (data.reply) {
                const newMsg = {
                    id: Date.now() + 1,
                    role: 'assistant' as const,
                    text: data.reply,
                    action: data.action,
                    data: data.data
                };
                setMessages(prev => [...prev, newMsg]);

                if (data.action === 'propose_schedule' && data.data && Array.isArray(data.data)) {
                    // Normalize dates to strict ISO to ensure Backend accepts them
                    const normalizedData = data.data.map((item: any) => ({
                        ...item,
                        start: new Date(item.start).toISOString(),
                        end: new Date(item.end).toISOString()
                    }));
                    setScheduleProposal({ data: normalizedData, messageId: newMsg.id });
                }
            }

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', text: "Error connecting to Hercules AI." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading) {
            handleCommand(inputValue);
        }
    };

    const clearHistory = () => {
        // Automatically clear without confirmation
        const richWelcome = getWelcomeMessage(type);
        const newHistory: Message[] = [{
            id: Date.now(),
            role: 'assistant',
            text: richWelcome
        }];
        setMessages(newHistory);
        setHasStartedChat(false);
        localStorage.setItem(storageKey, JSON.stringify(newHistory));
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
            {scheduleProposal && (
                <Scheduler
                    proposal={scheduleProposal.data}
                    onClose={() => setScheduleProposal(null)}
                    onChange={(newSchedule) => {
                        // Persist changes to message history
                        setMessages(prev => prev.map(m =>
                            m.id === scheduleProposal.messageId
                                ? { ...m, data: newSchedule }
                                : m
                        ));
                        // Also update current view so it doesn't flicker back
                        setScheduleProposal(prev => prev ? { ...prev, data: newSchedule } : null);
                    }}
                    onConfirm={async (finalSchedule) => {
                        const token = localStorage.getItem('token');
                        const res = await fetch("http://localhost:8080/api/calendar/sync-schedule", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({ events: finalSchedule }),
                        });

                        const responseData = await res.json();

                        if (res.ok) {
                            alert(`Success! Backend reply: ${responseData.message}`);
                        } else {
                            throw new Error(responseData.error || "Failed to sync");
                        }
                    }}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Branding/Title - Absolute Top Left */}
                <div className="absolute top-6 left-6 z-10 pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
                    <div className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 text-transparent bg-clip-text">
                        {title}
                    </div>
                </div>

                {/* --- HERO MODE --- */}
                {!hasStartedChat && (
                    <main className="w-full h-full flex flex-col justify-center items-center text-center space-y-8 p-4 animate-fade-in-up overflow-y-auto">
                        <div className="space-y-4">
                            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                Hello, Lawyer.
                            </h1>
                            <p className="text-xl text-muted-foreground">What would you like to focus on today?</p>
                        </div>

                        <div className="flex flex-col gap-4 w-full max-w-sm">
                            {hasHistory ? (
                                <>
                                    <button
                                        onClick={() => setHasStartedChat(true)}
                                        className="w-full py-4 text-lg font-semibold bg-primary text-primary-foreground rounded-xl shadow-lg hover:shadow-primary/25 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <span>💬</span> Resume Interaction
                                    </button>
                                    <button
                                        onClick={clearHistory}
                                        className="w-full py-3 text-sm font-medium bg-card text-muted-foreground border border-border rounded-xl hover:bg-muted/50 hover:text-destructive transition-colors"
                                    >
                                        Start Fresh Session
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setHasStartedChat(true)}
                                    className="w-full py-4 text-lg font-semibold bg-primary text-primary-foreground rounded-xl shadow-lg hover:shadow-primary/25 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
                                >
                                    <span>✨</span> Start Interaction
                                </button>
                            )}
                        </div>

                        {!isMoneta && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl px-4">
                                <ActionButton
                                    icon="📂"
                                    title="View Cases"
                                    desc="Manage active files"
                                    onClick={() => navigate('/dashboard')}
                                />
                                <ActionButton
                                    icon="📅"
                                    title="Weekly Schedule"
                                    desc="Optimize your time"
                                    onClick={() => handleCommand("Plan my week")}
                                />
                                <ActionButton
                                    icon="📝"
                                    title="Personal Tasks"
                                    desc="Organize your life"
                                    onClick={() => navigate('/tasks')}
                                />
                            </div>
                        )}
                    </main>
                )}

                {/* --- CHAT MODE --- */}
                {hasStartedChat && (
                    <>
                        <main className="flex-1 w-full max-w-4xl mx-auto p-4 overflow-y-auto flex flex-col space-y-6 scrollbar-hide">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-5 rounded-2xl shadow-sm ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : 'bg-card text-card-foreground border border-border rounded-bl-none'
                                        }`}>
                                        <div className={`text-sm leading-relaxed prose prose-sm max-w-none ${msg.role === 'user' ? 'text-primary-foreground/90' : 'dark:text-slate-200'}`}>
                                            <ReactMarkdown
                                                urlTransform={(value: string) => value}
                                                components={{
                                                    a: ({ node, href, children, ...props }) => {
                                                        // Handle both protocols for backward compatibility
                                                        if (href?.startsWith('view-case://') || href?.startsWith('case://')) {
                                                            const id = href.replace('view-case://', '').replace('case://', '');
                                                            return (
                                                                <button
                                                                    onClick={() => navigate(`/dashboard?caseId=${id}`)}
                                                                    className="mt-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-xs font-bold hover:bg-secondary/80 transition inline-flex items-center border border-border"
                                                                >
                                                                    {children} <span className="ml-1">↗</span>
                                                                </button>
                                                            );
                                                        }
                                                        return <a href={href} {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{children}</a>;
                                                    }
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Manual Action Buttons */}
                                        {msg.action === 'navigate_dashboard' && (
                                            <div className="mt-4 pt-4 border-t border-border/50">
                                                <button
                                                    onClick={() => navigate('/dashboard')}
                                                    className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/80 transition flex items-center shadow-sm border border-border"
                                                >
                                                    <span className="mr-2">📂</span> Open Dashboard
                                                </button>
                                            </div>
                                        )}
                                        {msg.action === 'propose_schedule' && msg.data && (
                                            <div className="mt-4 pt-4 border-t border-border/50">
                                                <button
                                                    onClick={() => {
                                                        // Normalize dates on click just in case
                                                        const raw = Array.isArray(msg.data) ? msg.data : [msg.data];
                                                        const normalized = raw.map((item: any) => ({
                                                            ...item,
                                                            start: new Date(item.start).toISOString(),
                                                            end: new Date(item.end).toISOString()
                                                        }));
                                                        setScheduleProposal({ data: normalized, messageId: msg.id });
                                                    }}
                                                    className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-100 transition flex items-center shadow-sm border border-green-200"
                                                >
                                                    <span className="mr-2">📅</span> Review Schedule
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-card p-4 rounded-2xl rounded-bl-none border border-border shadow-sm">
                                        <span className="animate-pulse text-muted-foreground">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </main>

                        <div className="w-full bg-card/50 backdrop-blur border-t border-border p-4 z-20">
                            <div className="max-w-4xl mx-auto flex items-center space-x-2">
                                <div className="flex-1 bg-muted/50 rounded-full px-4 py-2 flex items-center focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                                        placeholder="Ask Hercules..."
                                        autoFocus
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>
                                <button
                                    onClick={() => handleCommand(inputValue)}
                                    disabled={isLoading || !inputValue.trim()}
                                    className="bg-primary text-primary-foreground p-3 rounded-full hover:bg-primary/90 disabled:opacity-50 transition shadow-md"
                                >
                                    <span className="sr-only">Send</span>
                                    →
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Right Sidebar */}
            <aside className="w-16 hover:w-56 transition-all duration-300 ease-in-out border-l border-border bg-card/80 backdrop-blur-md flex flex-col items-center py-6 gap-6 z-30 shadow-2xl group overflow-hidden">

                {/* Navigation Items */}
                <div className="flex flex-col w-full px-2 gap-2">
                    <SidebarButton onClick={() => navigate('/')} icon="🏠" label="Home" />

                    {isMoneta ? (
                        <SidebarButton onClick={() => navigate('/hercules')} icon="⚖️" label="Switch to Hercules" />
                    ) : (
                        <SidebarButton onClick={() => navigate('/moneta')} icon="💰" label="Switch to Moneta" />
                    )}

                    {hasStartedChat && (
                        <SidebarButton onClick={() => setHasStartedChat(false)} icon="⬅️" label="Back" />
                    )}

                    <SidebarButton onClick={() => navigate('/settings')} icon="⚙️" label="Settings" />
                </div>

                <div className="flex-1" />

                {/* Utils */}
                <div className="flex flex-col w-full px-2 gap-2">
                    {(() => {
                        try {
                            const user = JSON.parse(localStorage.getItem('user') || '{}');
                            if (!user.has_calendar_linked) {
                                return <SidebarButton onClick={() => window.location.href = 'http://localhost:8080/auth/google/login'} icon="🔗" label="Connect Calendar" />;
                            } else {
                                return <SidebarButton onClick={() => { }} icon="✅" label="Calendar Linked" disabled />;
                            }
                        } catch (e) { return null; }
                    })()}
                </div>

                <div className="w-full px-4 border-t border-border/50 pt-4 mt-2">
                    {hasStartedChat && (
                        <SidebarButton onClick={clearHistory} icon="🗑️" label="Clear Chat" danger />
                    )}
                    <SidebarButton
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            localStorage.removeItem(storageKey);
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

function SidebarButton({ icon, label, onClick, disabled, danger }: { icon: string, label: string, onClick: () => void, disabled?: boolean, danger?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center w-full p-3 rounded-xl transition-all group/btn ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'} ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground'}`}
            title={label}
        >
            <span className="text-2xl mr-4 min-w-[24px] flex justify-center">{icon}</span>
            <span className="font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 origin-left delay-75">
                {label}
            </span>
        </button>
    );
}

function ActionButton({ icon, title, desc, onClick }: { icon: string, title: string, desc: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center p-6 bg-card rounded-xl shadow-sm border border-border hover:shadow-md hover:border-primary/50 transition-all text-left group"
        >
            <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">{icon}</span>
            <span className="text-lg font-bold text-foreground">{title}</span>
            <span className="text-sm text-muted-foreground">{desc}</span>
        </button>
    );
}
