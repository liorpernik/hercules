// Domain Types

export type Case = {
    id: string;
    title: string;
    status: 'new' | 'ongoing' | 'closed';
    priorityScore: number;
    assignedUser?: string;
    assigned_user_id?: string;
    deadline?: string;
    source: string;
    ext_data?: Record<string, unknown>;
    created_at?: string;
    phase?: string;
    charges?: string;
    lastHearing?: string;
    nextCourtDate?: string;
    jurisdiction?: string;
    pendingActions?: string;
    jailVisit?: boolean;
    clientProfile?: string;
    lastInteraction?: string;
    balanceDue?: number;
    currentOrPastDue?: string;
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    pastDueAmount?: number;
    leadAttorney?: string;
};

// Raw JSON from Go Backend
export type BackendCase = {
    id: string;
    account_id: string;
    title: string;
    status: string;
    source: string;
    assigned_user_id?: string;
    priority_score: number;
    ext_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    phase?: string;
    charges?: string;
    last_hearing?: string;
    next_court_date?: string;
    jurisdiction?: string;
    pending_actions?: string;
    jail_visit?: boolean;
    client_profile?: string;
    last_interaction?: string;
    balance_due?: number;
    current_or_past_due?: string;
    last_payment_date?: string;
    last_payment_amount?: number;
    past_due_amount?: number;
    lead_attorney?: string;
};

export const MOCK_CASES: Case[] = [
    { id: '1', title: 'Smith vs State', status: 'new', priorityScore: 95, deadline: '2026-01-15', source: 'Manual' },
    { id: '2', title: 'Corporate Merger A', status: 'ongoing', priorityScore: 80, assignedUser: 'Lawyer A', source: 'Email' },
    { id: '3', title: 'Estate Planning B', status: 'new', priorityScore: 40, source: 'Web' },
    { id: '4', title: 'Doe Divorce', status: 'ongoing', priorityScore: 88, assignedUser: 'Lawyer B', deadline: '2026-02-01', source: 'Referral' },
];
