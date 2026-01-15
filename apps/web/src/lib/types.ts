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
    lastStatus?: 'No Change' | 'Changed' | 'Error' | 'Blocked - Manual Verification Required' | 'Needs Manual Verification' | 'Verified';
    lastHash?: string;

    // Hardening / Operational Visibility
    consecutive403?: number;
    manualOnly?: boolean;
    needsCheck?: boolean;
    lastRunAt?: any; // Timestamp
    lastError?: string | null;
    lastVerifiedAt?: any; // Timestamp
    consecutiveFailures?: number;
    volatilityScore?: number;
    lastChangeScore?: number;
    lastChangeSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ChangeLog {
    id?: string;
    sourceId: string;
    userId: string;
    detectedAt: any; // Firestore Timestamp
    diffSummary: string;
    sourceUrl: string;
    score?: number;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    scoreReasons?: string[];
}

// Plan Limits
export const PLAN_LIMITS = {
    Starter: 5,
    Pro: 25,
    Enterprise: 9999,
};
