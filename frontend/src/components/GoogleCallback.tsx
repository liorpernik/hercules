import { useEffect } from 'react';

export default function GoogleCallback() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            // Redirect to backend to finish the handshake
            window.location.href = `http://localhost:8080/auth/google/callback?code=${code}`;
        } else {
            // Handle error or cancel
            window.location.href = '/dashboard?error=auth_failed';
        }
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-700 mb-2">Connecting to Google...</h2>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
        </div>
    );
}
