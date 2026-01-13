export interface UserProfile {
    uid: string;
    email: string | null;
    organization?: string;
    plan: 'Starter' | 'Pro' | 'Enterprise';
}

export interface MonitoredSource {
    id?: string;
    userId: string;
    name: string;
    url: string;
    frequency: 'Daily' | 'Weekly';
    lastChecked?: any; // Firestore Timestamp
    lastStatus?: 'No Change' | 'Changed' | 'Error';
    lastHash?: string;
}

export interface ChangeLog {
    id?: string;
    sourceId: string;
    userId: string;
    detectedAt: any; // Firestore Timestamp
    diffSummary: string;
    sourceUrl: string;
}

// Plan Limits
export const PLAN_LIMITS = {
    Starter: 5,
    Pro: 25,
    Enterprise: 9999,
};
