import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const EVENTS = ['mousemove', 'keydown', 'click', 'scroll'];
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export default function AutoLogout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const logout = () => {
        console.log("Auto-logging out due to inactivity");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const resetTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(logout, TIMEOUT_MS);
    };

    useEffect(() => {
        // Only activate if logged in (token exists)
        const token = localStorage.getItem('token');
        if (!token) return;

        // Initial set
        resetTimer();

        // Add listeners
        EVENTS.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Cleanup
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            EVENTS.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [navigate]); // Re-run if navigate changes (rare) or component remounts

    return <>{children}</>;
}
