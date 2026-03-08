import type { BackendCase, Case } from './types';

const API_BASE_URL = 'http://localhost:8080/api';

export async function fetchCases(): Promise<Case[]> {
    try {
        const token = localStorage.getItem('token');
        console.log("Fetching cases from:", `${API_BASE_URL}/cases`);
        const response = await fetch(`${API_BASE_URL}/cases`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log("Response status:", response.status);

        if (!response.ok) {
            const text = await response.text();
            console.error("API Error Body:", text);
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data: BackendCase[] = await response.json();
        console.log("Raw API Data:", data);

        // Transform BackendCase (snake_case) to Case (camelCase)
        return data.map(transformCase);
    } catch (error) {
        console.error("Failed to fetch cases:", error);
        throw error;
    }
}

function transformCase(bc: BackendCase): Case {
    return {
        id: bc.id,
        title: bc.title,
        status: isValidStatus(bc.status) ? bc.status : 'new',
        priorityScore: bc.priority_score,
        // Map Lead Attorney to assignedUser (for display) if generic ID is not useful
        assignedUser: bc.lead_attorney || (bc.assigned_user_id ? `User ${bc.assigned_user_id.substring(0, 4)}` : undefined),
        assigned_user_id: bc.assigned_user_id,
        deadline: bc.ext_data && bc.ext_data['deadline'] ? String(bc.ext_data['deadline']) : undefined,
        source: bc.source || 'manual',
        ext_data: bc.ext_data,
        created_at: bc.created_at,
        phase: bc.phase,
        charges: bc.charges,
        lastHearing: bc.last_hearing,
        nextCourtDate: bc.next_court_date,
        jurisdiction: bc.jurisdiction,
        pendingActions: bc.pending_actions,
        jailVisit: bc.jail_visit,
        clientProfile: bc.client_profile,
        lastInteraction: bc.last_interaction,
        balanceDue: bc.balance_due,
        currentOrPastDue: bc.current_or_past_due,
        lastPaymentDate: bc.last_payment_date,
        lastPaymentAmount: bc.last_payment_amount,
        pastDueAmount: bc.past_due_amount,
        leadAttorney: bc.lead_attorney
    };
}

function isValidStatus(status: string): status is 'new' | 'ongoing' | 'closed' {
    return ['new', 'ongoing', 'closed'].includes(status);
}

export type UserSummary = {
    id: string;
    email: string;
    full_name: string;
    role: string;
    location?: string;
    seniority_level?: string;
    account_id: string;
    created_at: string;
};

export async function fetchUsers(): Promise<UserSummary[]> {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}
