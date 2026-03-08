import { useState, useMemo } from 'react';

type ScheduleItem = {
    title: string;
    start: string;
    end: string;
    case_id?: string;
    is_external?: boolean;
};

type Props = {
    proposal: ScheduleItem[];
    onClose: () => void;
    onConfirm: (schedule: ScheduleItem[]) => void;
    onChange?: (schedule: ScheduleItem[]) => void;
};

export default function Scheduler({ proposal, onClose, onConfirm, onChange }: Props) {
    const [schedule, setSchedule] = useState(proposal || []);

    // Notify parent of changes
    const updateSchedule = (newSchedule: ScheduleItem[]) => {
        setSchedule(newSchedule);
        if (onChange) onChange(newSchedule);
    };
    const [submitting, setSubmitting] = useState(false);
    const [draggedItem, setDraggedItem] = useState<{ item: ScheduleItem; index: number } | null>(null);
    const [editingItem, setEditingItem] = useState<{ item: ScheduleItem; index: number } | null>(null);

    // Generate time slots (9 AM - 6 PM in 30-min increments)
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let hour = 9; hour <= 17; hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
            if (hour < 17) slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
        return slots;
    }, []);

    // Get the current week (Mon-Fri) based on the first proposed item
    const workingDays = useMemo(() => {
        const days = [];
        // Default to today, but if proposal exists, use the first item's start date
        let anchorDate = new Date();
        if (proposal && proposal.length > 0) {
            anchorDate = new Date(proposal[0].start);
        }

        // Find Monday of that week
        const dayOfWeek = anchorDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
        const monday = new Date(anchorDate);
        monday.setDate(anchorDate.getDate() + diff);

        // Add Mon-Fri
        for (let i = 0; i < 5; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            days.push(day);
        }

        return days;
    }, [proposal]);

    // Create a grid map of scheduled items
    const scheduleGrid = useMemo(() => {
        const grid: Record<string, ScheduleItem[]> = {};

        if (!schedule || !Array.isArray(schedule)) {
            return grid;
        }

        schedule.forEach(item => {
            if (!item || !item.start) return;
            const date = new Date(item.start);
            const dateKey = date.toDateString();

            if (!grid[dateKey]) grid[dateKey] = [];
            grid[dateKey].push(item);
        });

        return grid;
    }, [schedule]);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            // Filter out external events so we don't duplicate them in the calendar
            const toSync = schedule.filter(item => !item.is_external);
            await onConfirm(toSync);
            onClose();
        } catch (e) {
            alert("Failed to sync schedule");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
        e.preventDefault();
        if (!draggedItem) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;

        // 17 slots * 60px = 1020px height
        // 9:00 to 17:30 (ish) -> 17 slots of 30 mins = 510 minutes?
        // Actually code generates 9:00, 9:30 ... 17:00.
        // That is 17 slots. 17 * 30min = 510 minutes. 
        // 1020px / 510min = 2px per minute.

        // Granularity: 5 minutes words = 10px.
        const SNAP_PIXELS = 10;
        const snappedY = Math.round(offsetY / SNAP_PIXELS) * SNAP_PIXELS;

        // Convert pixels back to minutes from 9:00
        const minutesFromStart = snappedY / 2;

        const newStart = new Date(day);
        newStart.setHours(9, 0, 0, 0); // Reset to 9:00 base
        newStart.setMinutes(minutesFromStart);

        const originalDuration = new Date(draggedItem.item.end).getTime() - new Date(draggedItem.item.start).getTime();
        const newEnd = new Date(newStart.getTime() + originalDuration);

        const updatedSchedule = schedule.map((item, idx) =>
            idx === draggedItem.index
                ? { ...item, start: newStart.toISOString(), end: newEnd.toISOString() }
                : item
        );

        updateSchedule(updatedSchedule);
        setDraggedItem(null);
    };

    const removeItem = (index: number) => {
        updateSchedule(schedule.filter((_, idx) => idx !== index));
    };

    const handleSaveEdit = (newStart: string, newEnd: string) => {
        if (!editingItem) return;

        const updatedSchedule = schedule.map((item, idx) =>
            idx === editingItem.index
                ? { ...item, start: new Date(newStart).toISOString(), end: new Date(newEnd).toISOString() }
                : item
        );

        updateSchedule(updatedSchedule);
        setEditingItem(null);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            {editingItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-2xl border border-slate-200 w-96 animate-fade-in-up">
                        <h3 className="text-xl font-bold mb-4 text-slate-800">Edit Time</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Start Time</label>
                                <input
                                    type="datetime-local"
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                    defaultValue={new Date(editingItem.item.start).toLocaleString('sv').slice(0, 16).replace(' ', 'T')}
                                    id="edit-start"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">End Time</label>
                                <input
                                    type="datetime-local"
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                    defaultValue={new Date(editingItem.item.end).toLocaleString('sv').slice(0, 16).replace(' ', 'T')}
                                    id="edit-end"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setEditingItem(null)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const startInput = (document.getElementById('edit-start') as HTMLInputElement).value;
                                        const endInput = (document.getElementById('edit-end') as HTMLInputElement).value;
                                        handleSaveEdit(startInput, endInput);
                                    }}
                                    className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-semibold"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">📅 Your Proposed Schedule</h2>
                            <p className="text-slate-600">Drag tasks to reschedule (5-minute precision)</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 text-3xl leading-none"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-auto p-6 bg-slate-50 relative">
                    <div className="min-w-max">
                        {/* Header Row */}
                        <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-4 mb-4 sticky top-0 bg-slate-50 z-20 pb-2">
                            <div className="font-semibold text-slate-500 text-sm"></div>
                            {workingDays.map((day, idx) => {
                                const isToday = day.toDateString() === new Date().toDateString();
                                return (
                                    <div
                                        key={idx}
                                        className={`text-center p-3 rounded-lg shadow-sm border ${isToday
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-slate-700 border-slate-200'
                                            }`}
                                    >
                                        <div className="font-bold text-lg">
                                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div className="text-sm opacity-90">
                                            {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Schedule Body */}
                        <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-4 relative">
                            {/* Time Labels Column */}
                            <div className="flex flex-col relative">
                                {timeSlots.map((timeSlot, i) => (
                                    <div key={i} className="h-[60px] text-xs font-semibold text-slate-400 text-right pr-4 relative">
                                        <span className="absolute -top-2 right-4 -translate-y-1/2">{timeSlot}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Days Columns */}
                            {workingDays.map((day, dayIdx) => (
                                <div
                                    key={dayIdx}
                                    className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden h-[1020px]"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, day)}
                                >
                                    {/* Background Grid Lines (Visual Only) */}
                                    {timeSlots.map((_, slotIdx) => (
                                        <div
                                            key={slotIdx}
                                            className="h-[60px] border-b border-slate-50 w-full transition-colors pointer-events-none"
                                        />
                                    ))}

                                    {/* Absolute Events */}
                                    {scheduleGrid[day.toDateString()]?.map((item, itemIdx) => {
                                        // Calculate Position
                                        const start = new Date(item.start);
                                        const end = new Date(item.end);

                                        // Minutes from 9:00 AM
                                        const startMinutes = (start.getHours() * 60 + start.getMinutes()) - (9 * 60);
                                        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

                                        // 60px per 30 mins => 2px per minute
                                        const top = startMinutes * 2;
                                        const height = durationMinutes * 2;

                                        return (
                                            <div
                                                key={itemIdx}
                                                draggable={!item.is_external}
                                                onDragStart={() => !item.is_external && setDraggedItem({ item, index: schedule.findIndex(s => s === item) })}
                                                onDragEnd={() => setDraggedItem(null)}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!item.is_external) {
                                                        setEditingItem({ item, index: schedule.findIndex(s => s === item) });
                                                    }
                                                }}
                                                className={`absolute inset-x-1 rounded-lg p-2 text-xs shadow-md transition-all border overflow-hidden ${item.is_external
                                                    ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-default opacity-80'
                                                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-400/50 cursor-move hover:shadow-lg hover:z-10 group'
                                                    }`}
                                                style={{
                                                    top: `${top}px`,
                                                    height: `${height}px`,
                                                    zIndex: item.is_external ? 5 : 10
                                                }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={`font-bold truncate mr-1 ${item.is_external ? 'text-slate-600' : ''}`}>{item.title}</span>
                                                    {!item.is_external && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const idx = schedule.findIndex(s => s === item);
                                                                if (idx !== -1) removeItem(idx);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 bg-black/20 hover:bg-black/40 rounded-full w-4 h-4 flex items-center justify-center text-[10px] transition"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="opacity-90 mt-0.5 text-[10px]">
                                                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                    {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                {item.case_id && (
                                                    <div className="text-[10px] opacity-75 truncate mt-1 bg-black/10 px-1 rounded inline-block">
                                                        Case: {item.case_id.slice(0, 8)}...
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-white rounded-b-2xl">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-600">
                            💡 <span className="font-semibold">Tip:</span> Drag and drop tasks to reschedule them
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={submitting}
                                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin">⏳</span>
                                        Syncing...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Confirm & Sync to Calendar
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}