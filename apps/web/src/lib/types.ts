export interface UserProfile {
    uid: string;
    email: string | null;
    organization?: string;
    plan: 'Starter' | 'Pro' | 'Enterprise';
    onboardingComplete?: boolean;
}

export interface MonitoredSource {
    id?: string;
    userId: string;
    name: string;
    url: string;
    frequency: 'Daily' | 'Weekly';
    lastChecked?: any; // Firestore Timestamp
    lastStatus?: 'No Change' | 'Changed' | 'Error' | 'Blocked - Manual Verification Required' | 'Needs Manual Verification' | 'Verified' | 'OK';
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
    watchMode?: 'FullContent' | 'MetadataOnly';

    // Phase 3 Hardening
    status?: 'OK' | 'CHANGED' | 'ERROR' | 'BLOCKED' | 'NEEDS_MANUAL_VERIFICATION' | 'PAUSED' | 'DEGRADED';
    lastCheckedAt?: any; // Timestamp
    nextCheckAt?: any; // Timestamp
    lastSuccessAt?: any; // Timestamp

    // Backoff
    backoffLevel?: number; // 0..N

    // Pause Controls
    pausedAt?: any; // Timestamp
    pausedBy?: string;
    pauseReason?: 'TEMPORARY' | 'TOO_NOISY' | 'BLOCKED_SITE' | 'NOT_NEEDED' | 'OTHER';

    // Verification Snapshots
    verifiedAt?: any; // Timestamp
    verifiedBy?: string;
    verifiedReason?: 'FALSE_POSITIVE' | 'EXPECTED_CHANGE' | 'BLOCKED_BUT_OK' | 'OTHER';
    verifiedNote?: string;
    verifiedHash?: string;
    verifiedFingerprint?: {
        watchMode: 'FullContent' | 'MetadataOnly';
        title?: string;
        metaDescription?: string;
        contentSample?: string;
        url: string;
    } | null;

    lastTitle?: string;
    lastMetaDescription?: string;
    lastContentSample?: string;

    // Phase 4: Guardian Mode (Meaning + Judgment)
    severityScore?: number; // 0-100
    severityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    severityReasons?: string[];
    extractedDeadlines?: {
        date: any; // Timestamp
        label?: string;
        sourceText: string;
    }[];
    nextDeadline?: any; // Timestamp
    alertThreshold?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    alertMode?: 'INSTANT' | 'DIGEST' | 'CRITICAL_ONLY';

    // Phase 5: Guidance & Confidence
    actionGuidance?: string;
    actionConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    actionCategory?: 'NO_ACTION' | 'REVIEW' | 'UPDATE' | 'ESCALATE';
    confidenceNotes?: string[];

    // Phase 6: Learning & Closure
    confidenceScore?: number; // 0-100
    confidenceLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    confidenceStats?: {
        totalActions: number;
        noActionCount: number;
        reviewCount: number;
        escalateCount: number;
        falseAlarmCount: number;
        lastActionAt?: any;
    };
    ackStatus?: 'ACK_NO_ACTION' | 'ACK_REVIEWED' | 'ACK_UPDATED' | 'ACK_ESCALATED';
    ackAt?: any;
    ackBy?: string;
}

export interface ChangeLog {
    id?: string;
    sourceId: string;
    userId: string;
    detectedAt: any; // Firestore Timestamp
    diffSummary: string;
    sourceUrl: string;
    score?: number; // Legacy from Phase 2
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // Legacy from Phase 2
    scoreReasons?: string[]; // Legacy from Phase 2

    // Phase 4: Enhanced Judgment
    severityScore?: number;
    severityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    severityReasons?: string[];
    explanationBullets?: string[];
    extractedDeadlines?: {
        date: any; // Timestamp
        label?: string;
        sourceText: string;
    }[];
    deadlineImpact?: 'NONE' | 'MOVED_EARLIER' | 'MOVED_LATER' | 'NEW_DEADLINE';

    // Phase 5: Guidance & Confidence
    actionGuidance?: string;
    actionCategory?: 'NO_ACTION' | 'REVIEW' | 'UPDATE' | 'ESCALATE';
    actionConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    confidenceNotes?: string[];

    // Phase 6: Acknowledgement
    ackStatus?: 'ACK_NO_ACTION' | 'ACK_REVIEWED' | 'ACK_UPDATED' | 'ACK_ESCALATED';
    ackAt?: any;
    ackBy?: string;
}

export interface AuditLog {
    id?: string;
    userId: string;
    action: string;
    sourceId: string;
    sourceName: string;
    timestamp: any; // Firestore Timestamp
    details?: string;

    // Phase 3 Snapshot Linkage
    verifiedHash?: string;
    verifiedReason?: string;
    sourceSnapshot?: {
        watchMode: 'FullContent' | 'MetadataOnly';
        title?: string;
        metaDescription?: string;
        contentSample?: string;
        url: string;
    };
}

// Plan Limits
export const PLAN_LIMITS = {
    Starter: 5,
    Pro: 25,
    Enterprise: 9999,
};
