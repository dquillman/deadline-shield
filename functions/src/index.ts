import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cheerio from "cheerio";
import * as crypto from "crypto";
import * as sgMail from "@sendgrid/mail";

admin.initializeApp();
const db = admin.firestore();

// Configure SendGrid (Safe Failure for Hardening)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("SendGrid API Key missing. Email alerts will be skipped safely.");
}

// --- Hardening Feature 1: Server-Side Tier Enforcement ---

const PLAN_LIMITS: Record<string, number> = {
  Starter: 5,
  Pro: 25,
  Enterprise: 9999,
};

export const createSource = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }
  const uid = context.auth.uid;
  const { name, url, frequency } = data;

  // Validate Input
  if (!name || !url) {
    throw new functions.https.HttpsError("invalid-argument", "Name and URL are required");
  }

  // Get User Plan
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.data();
  const plan = userData?.plan || "Starter";

  // Count Existing Sources
  const sourcesSnap = await db.collection("sources").where("userId", "==", uid).count().get();
  const currentCount = sourcesSnap.data().count;

  // Enforce Limit
  const limit = PLAN_LIMITS[plan] || 5;
  if (currentCount >= limit) {
    throw new functions.https.HttpsError("resource-exhausted", `Plan limit reached (${limit}). Upgrade to add more.`);
  }

  // Create Source
  const newSource = {
    userId: uid,
    name,
    url,
    frequency: frequency || "Daily",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastStatus: "No Change",
    consecutive403: 0,
    manualOnly: false,
    needsCheck: false,
    consecutiveFailures: 0,
  };

  const docRef = await db.collection("sources").add(newSource);
  return { id: docRef.id };
});


// --- Helper: Noise Reduction (Hardening Feature 5) ---
const normalizeContent = (html: string): string => {
  const $ = cheerio.load(html);
  $('script').remove();
  $('style').remove();
  $('noscript').remove();
  $('iframe').remove();
  $('header').remove();
  $('footer').remove();
  $('nav').remove();        // Additional filtering
  $('[role="alert"]').remove(); // Often dynamic banners

  let text = $.text();
  text = text.replace(/\s+/g, ' ').trim();
  // Truncate to avoid massive storage if something goes wrong
  return text.substring(0, 50000);
};

// Helper: Hash
const computeHash = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

// --- Helper: Importance Scoring (Hardening Feature 1) ---

// Legacy calculateImportance removed and replaced by Guardian Mode scoring.

// --- Guardian Mode Logic (Phase 4) ---

const URGENCY_KEYWORDS = [
  'deadline', 'due', 'must', 'required', 'effective', 'enforcement', 'penalty', 'compliance',
  'mandatory', 'urgent', 'action required', 'immediate'
];

function calculateGuardianSeverity(content: string, diff: string, source: any): { score: number, level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Date Changes (Very High Weight)
  const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4}\b/gi;
  if (datePattern.test(diff)) {
    score += 40;
    reasons.push("A deadline or date expression was modified.");
  }

  // 2. Urgency Keywords
  const foundKeywords = URGENCY_KEYWORDS.filter(kw => new RegExp(`\\b${kw}\\b`, 'i').test(diff));
  if (foundKeywords.length > 0) {
    score += Math.min(foundKeywords.length * 10, 30);
    reasons.push(`Urgent language ('${foundKeywords.slice(0, 2).join("', '")}') was added.`);
  }

  // 3. Diff Magnitude (Normalized)
  const magnitude = Math.min((diff.length / 500) * 10, 15);
  if (magnitude > 10) {
    score += magnitude;
    reasons.push("Significant content volume changed.");
  }

  // 4. Historical Volatility Dampening
  if (source.volatilityScore > 0.7) {
    score *= 0.7;
    reasons.push("This page changes frequently, which may dampen significance.");
  }

  // 4b. Confidence Learning Dampening (Phase 6)
  // If the source has high confidence and many NO_ACTION acks, slightly dampen non-deadline changes
  if (source.confidenceScore > 80 && !datePattern.test(diff)) {
    score *= 0.8;
    reasons.push("Historically stable with low noise; dampening minor change.");
  }

  // 5. WatchMode context
  if (source.watchMode === 'MetadataOnly' && score < 80) {
    score = Math.min(score, 50);
  }

  // Final Clamp & Level Mapping
  const finalScore = Math.min(Math.round(score), 100);
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (finalScore > 80) level = 'CRITICAL';
  else if (finalScore > 50) level = 'HIGH';
  else if (finalScore > 20) level = 'MEDIUM';

  return { score: finalScore, level, reasons };
}

function extractDeadlines(content: string): { date: admin.firestore.Timestamp, label?: string, sourceText: string }[] {
  const deadlines: { date: admin.firestore.Timestamp, label?: string, sourceText: string }[] = [];
  const dateRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi;

  let match;
  while ((match = dateRegex.exec(content)) !== null) {
    const dateStr = match[0];
    const dateObj = new Date(dateStr);

    if (!isNaN(dateObj.getTime())) {
      const textBefore = content.substring(Math.max(0, match.index - 50), match.index);
      const labelMatch = textBefore.match(/(?:Deadline|Due|Date|Effective|Required|By):\s*$/i);

      deadlines.push({
        date: admin.firestore.Timestamp.fromDate(dateObj),
        label: labelMatch ? labelMatch[0].trim() : undefined,
        sourceText: content.substring(Math.max(0, match.index - 20), Math.min(content.length, match.index + 20)).trim()
      });
    }
  }

  return deadlines.filter((v, i, a) => a.findIndex(t => t.date.toMillis() === v.date.toMillis()) === i);
}

function generateExplanationBullets(reasons: string[]): string[] {
  return reasons.slice(0, 3);
}

// --- Action Guidance & Confidence Layer (Phase 5) ---

function calculateActionGuidance(level: string, deadlineImpact: string): { category: 'NO_ACTION' | 'REVIEW' | 'UPDATE' | 'ESCALATE', guidance: string, confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
  if (level === 'LOW') {
    return { category: 'NO_ACTION', guidance: "No action needed. This appears to be an informational update.", confidence: 'HIGH' };
  }

  if (level === 'CRITICAL' && deadlineImpact === 'MOVED_EARLIER') {
    return { category: 'ESCALATE', guidance: "Immediate attention recommended. Deadline moved earlier.", confidence: 'HIGH' };
  }

  if (level === 'HIGH' || level === 'CRITICAL') {
    return { category: 'UPDATE', guidance: "Consider updating your timeline or documentation based on these changes.", confidence: 'MEDIUM' };
  }

  return { category: 'REVIEW', guidance: "Review this change to confirm it doesn't affect your project plans.", confidence: 'MEDIUM' };
}

function generateConfidenceNotes(source: any, extracted: any[], level: string): string[] {
  const notes: string[] = [];

  if (source.volatilityScore > 0.6) {
    notes.push("This type of page changes frequently; urgency is moderate.");
  }

  if (extracted.length === 0) {
    notes.push("No deadlines were identified or removed in this update.");
  } else if (level !== 'CRITICAL') {
    notes.push("Extracted dates do not indicate an accelerated deadline.");
  }

  if (source.lastVerifiedAt) {
    notes.push("You've successfully verified similar changes on this source before.");
  }

  return notes.slice(0, 2);
}

// Legacy helper for compatibility
function calculateImportance(content: string): { score: number, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', reasons: string[] } {
  const { score, level, reasons } = calculateGuardianSeverity(content, content, {});
  return { score, severity: level, reasons };
}

// --- Acknowledgement & Learning Logic (Phase 6) ---

export const acknowledgeChange = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required");
  const { changeId, ackStatus } = data;
  const uid = context.auth.uid;

  const changeRef = db.collection("changes").doc(changeId);
  const changeSnap = await changeRef.get();
  if (!changeSnap.exists) throw new functions.https.HttpsError("not-found", "Change not found");
  const change = changeSnap.data() as any;
  if (change.userId !== uid) throw new functions.https.HttpsError("permission-denied", "Unauthorized");

  const now = admin.firestore.Timestamp.now();

  // 1. Update Change Record
  await changeRef.update({
    ackStatus,
    ackAt: now,
    ackBy: uid
  });

  // 2. Write Audit Log
  await db.collection("audit_logs").add({
    userId: uid,
    sourceId: change.sourceId,
    changeId,
    action: "ACKNOWLEDGE_CHANGE",
    ackStatus,
    previousRecommendation: change.actionCategory,
    timestamp: now
  });

  // 3. Update Source Learning Stats
  const sourceRef = db.collection("sources").doc(change.sourceId);
  await db.runTransaction(async (transaction) => {
    const s = (await transaction.get(sourceRef)).data() as any;
    const stats = s.confidenceStats || { totalActions: 0, noActionCount: 0, reviewCount: 0, escalateCount: 0, falseAlarmCount: 0 };

    stats.totalActions += 1;
    stats.lastActionAt = now;

    if (ackStatus === 'ACK_NO_ACTION') {
      stats.noActionCount += 1;
      if (change.severityLevel === 'HIGH' || change.severityLevel === 'CRITICAL') {
        stats.falseAlarmCount += 1;
      }
    } else if (ackStatus === 'ACK_REVIEWED') stats.reviewCount += 1;
    else if (ackStatus === 'ACK_ESCALATED') stats.escalateCount += 1;

    // Derive Score-ish (very simple for MVP)
    let score = 50; // Baseline
    score += (stats.noActionCount / stats.totalActions) * 20;
    score -= (stats.falseAlarmCount / stats.totalActions) * 50;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (score > 80) level = 'HIGH';
    else if (score < 30) level = 'LOW';

    transaction.update(sourceRef, {
      confidenceStats: stats,
      confidenceScore: score,
      confidenceLevel: level
    });
  });

  return { success: true };
});

// --- Helper: Safe Email Sending (Hardening Feature 4) ---
const safeSendEmail = async (userEmail: string, subject: string, text: string, html: string) => {
  if (!SENDGRID_API_KEY || !userEmail) return null;

  try {
    const msg = {
      to: userEmail,
      from: 'alerts@deadline-shield.app',
      subject,
      text,
      html,
    };
    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Email failed safely:", error.message);
    return { success: false, error: error.message };
  }
};


// --- Hardened Change Detection Engine (Phase 3) ---
export const checkDeadlineUpdates = functions.pubsub.schedule('every 15 minutes') // More frequent check for backoff alignment
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log("Starting Phase 3 Hardened Change Detection Scan...");
    const now = admin.firestore.Timestamp.now();

    // Query sources that are NOT paused
    const sourcesSnap = await db.collection("sources").where("status", "!=", "PAUSED").get();

    const checkTasks: Promise<any>[] = [];

    for (const sourceDoc of sourcesSnap.docs) {
      const sourceId = sourceDoc.id;
      const source = sourceDoc.data() as any;

      // Filter: Respect nextCheckAt
      if (source.nextCheckAt && source.nextCheckAt.toMillis() > now.toMillis()) {
        continue;
      }

      checkTasks.push(db.runTransaction(async (transaction) => {
        const docRef = db.collection("sources").doc(sourceId);
        const freshSource = (await transaction.get(docRef)).data() as any;

        if (!freshSource) return;

        // 4. Per-source Locking
        if (freshSource.inProgressUntil && freshSource.inProgressUntil.toMillis() > now.toMillis()) {
          console.log(`Source ${freshSource.name} is locked. Skipping.`);
          return;
        }

        // Acquire Lock
        transaction.update(docRef, {
          inProgressUntil: admin.firestore.Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000), // 5 min TTL
          inProgressBy: context.eventId || 'scheduler'
        });

        // The actual check logic (performed outside transaction for the long-running fetch, 
        // but we'll use the lock to prevent others from starting)
        return { docRef, freshSource };
      }).then(async (lockResult) => {
        if (!lockResult) return;
        const { docRef, freshSource: source } = lockResult;

        try {
          console.log(`Checking ${source.name} (${source.url})...`);
          const response = await fetch(source.url, { timeout: 30000 } as any);

          // State Transitions: Blocking detection
          if (response.status === 403 || response.status === 429) {
            throw new Error(`BLOCKED: ${response.status}`);
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const html = await response.text();
          const normalized = normalizeContent(html);

          // Noise Reduction: Metadata vs Content
          let contentToHash = normalized;
          if (source.watchMode === 'MetadataOnly') {
            const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
            const meta = html.match(/<meta name="description" content="(.*?)"/i)?.[1] || "";
            contentToHash = title + "|" + meta;
          }
          const newHash = computeHash(contentToHash);

          // Metadata Snapshotting
          const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
          const meta = html.match(/<meta name="description" content="(.*?)"/i)?.[1] || "";
          const contentSample = normalized.substring(0, 280);

          let updateData: any = {
            lastCheckedAt: admin.firestore.Timestamp.now(),
            lastRunAt: admin.firestore.Timestamp.now(),
            inProgressUntil: null, // Release lock
            inProgressBy: null,
            lastTitle: title,
            lastMetaDescription: meta,
            lastContentSample: contentSample
          };

          if (source.lastHash && source.lastHash !== newHash) {
            console.log(`Change detected for ${source.name}`);

            // Phase 4: Guardian Scoring & Extraction
            const { score: gScore, level: gLevel, reasons: gReasons } = calculateGuardianSeverity(normalized, normalized, source); // Simplified diff for now
            const extracted = extractDeadlines(normalized);
            const nextDl = extracted.length > 0 ? extracted.sort((a, b) => a.date.toMillis() - b.date.toMillis())[0].date : null;

            // Phase 5: Action Guidance & Confidence
            let dlImpact: 'NONE' | 'MOVED_EARLIER' | 'MOVED_LATER' | 'NEW_DEADLINE' = 'NONE';
            if (extracted.length > 0 && nextDl && source.nextDeadline) {
              const oldMillis = source.nextDeadline.toMillis();
              const newMillis = (nextDl as any).toMillis();
              if (newMillis < oldMillis) dlImpact = 'MOVED_EARLIER';
              else if (newMillis > oldMillis) dlImpact = 'MOVED_LATER';
              else dlImpact = 'NONE';
            } else if (extracted.length > 0) {
              dlImpact = 'NEW_DEADLINE';
            }

            const { category: aCat, guidance: aGuid, confidence: aConf } = calculateActionGuidance(gLevel, dlImpact);
            const cNotes = generateConfidenceNotes(source, extracted, gLevel);

            await db.collection("changes").add({
              sourceId, userId: source.userId, detectedAt: admin.firestore.FieldValue.serverTimestamp(),
              diffSummary: "Content changed.", sourceUrl: source.url,
              severityScore: gScore, severityLevel: gLevel, severityReasons: gReasons,
              explanationBullets: generateExplanationBullets(gReasons),
              extractedDeadlines: extracted,
              deadlineImpact: dlImpact,
              actionCategory: aCat,
              actionGuidance: aGuid,
              actionConfidence: aConf,
              confidenceNotes: cNotes
            });

            updateData = {
              ...updateData,
              lastStatus: "Changed",
              status: "CHANGED",
              lastHash: newHash,
              needsCheck: true,
              consecutiveFailures: 0,
              backoffLevel: 0,
              lastSuccessAt: admin.firestore.Timestamp.now(),
              severityScore: gScore,
              severityLevel: gLevel,
              severityReasons: gReasons,
              extractedDeadlines: extracted,
              nextDeadline: nextDl,
              actionCategory: aCat,
              actionGuidance: aGuid,
              actionConfidence: aConf,
              confidenceNotes: cNotes
            };

            // Alert Intelligence: Respect threshold
            const userSnap = await db.collection("users").doc(source.userId).get();
            const userData = userSnap.data();
            const threshold = source.alertThreshold || 'MEDIUM';
            const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

            if (levels.indexOf(gLevel) >= levels.indexOf(threshold)) {
              console.log(`Alerting for ${source.name} (Level: ${gLevel}, Threshold: ${threshold})`);
              const emoji = gLevel === 'CRITICAL' ? '🚨' : gLevel === 'HIGH' ? '🔴' : gLevel === 'MEDIUM' ? '🟠' : '🟢';

              const subject = `${emoji} [${gLevel}] ${aCat}: ${source.name}`;
              const htmlBody = `
                <h3>Judgment: ${gLevel}</h3>
                <p><strong>Recommended Action:</strong> ${aGuid}</p>
                <ul>${generateExplanationBullets(gReasons).map(b => `<li>${b}</li>`).join("")}</ul>
                ${cNotes.length > 0 ? `<p style="color: #666; font-style: italic;">Note: ${cNotes.join(" ")}</p>` : ''}
                <p><a href="https://deadline-shield-web.web.app/dashboard">View Dashboard</a></p>
              `;

              await safeSendEmail(
                userData?.email,
                subject,
                `Action: ${aGuid}`,
                htmlBody
              );
            }
          } else {
            updateData = {
              ...updateData,
              lastStatus: "No Change",
              status: "OK",
              lastHash: newHash,
              consecutiveFailures: 0,
              backoffLevel: 0,
              lastSuccessAt: admin.firestore.Timestamp.now()
            };
          }

          // Reset nextCheckAt based on normal cadence
          const nextCheck = new Date();
          if (source.frequency === 'Weekly') nextCheck.setDate(nextCheck.getDate() + 7);
          else nextCheck.setDate(nextCheck.getDate() + 1); // Daily default
          updateData.nextCheckAt = admin.firestore.Timestamp.fromDate(nextCheck);

          await docRef.update(updateData);

        } catch (err: any) {
          console.error(`Error checking ${source.name}:`, err.message);

          // Backoff Logic
          const failures = (source.consecutiveFailures || 0) + 1;
          const backoff = (source.backoffLevel || 0) + 1;

          let nextCheckOffsetMinutes = 0;
          if (failures === 2) nextCheckOffsetMinutes = 30;
          else if (failures === 3) nextCheckOffsetMinutes = 120; // 2h
          else if (failures === 4) nextCheckOffsetMinutes = 720; // 12h
          else if (failures >= 5) nextCheckOffsetMinutes = 1440; // 24h

          const nextDate = new Date();
          nextDate.setMinutes(nextDate.getMinutes() + nextCheckOffsetMinutes);

          let newStatus = 'ERROR';
          if (err.message.includes('BLOCKED')) newStatus = 'BLOCKED';
          if (failures >= 5) newStatus = 'DEGRADED';
          if (failures >= 10) newStatus = 'NEEDS_MANUAL_VERIFICATION';

          await docRef.update({
            lastRunAt: admin.firestore.Timestamp.now(),
            lastError: err.message,
            consecutiveFailures: failures,
            backoffLevel: backoff,
            status: newStatus,
            lastStatus: newStatus,
            nextCheckAt: admin.firestore.Timestamp.fromDate(nextDate),
            inProgressUntil: null,
            inProgressBy: null
          });
        }
      }));
    }

    await Promise.all(checkTasks);
    return null;
  });

// --- Hardening 3: Manual Verification Workflow (Weekly trigger) ---
export const triggerWeeklyManualCheck = functions.pubsub.schedule('every sunday 09:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    // Find all manualOnly OR needs manual verification sources
    const snapshot = await db.collection("sources")
      .where("status", "in", ["NEEDS_MANUAL_VERIFICATION", "BLOCKED"])
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        needsCheck: true,
        lastStatus: "Needs Manual Verification",
        status: "NEEDS_MANUAL_VERIFICATION"
      });
    });

    if (!snapshot.empty) {
      await batch.commit();
      console.log(`Triggered manual checks for ${snapshot.size} sources.`);
    }
    return null;
  });


// --- Hardening 4: Weekly Digest Email ---
export const sendWeeklyDigest = functions.pubsub.schedule('every monday 08:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    // For MVP, simplistic implementation: Iterate users -> query their relevant sources
    // In prod, use collectionGroup or fan-out
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      const uid = userDoc.id;
      if (!user.email) continue;

      // Changes in last 7 days? Or just "Changed" status sources?
      // Requirement says: "Sources with detected changes" // "Sources needing manual verif"

      const sourcesSnap = await db.collection("sources")
        .where("userId", "==", uid)
        .get();

      const needsCheck = sourcesSnap.docs.filter(d => {
        const data = d.data();
        return data.needsCheck === true || data.status === "NEEDS_MANUAL_VERIFICATION";
      });

      const changedSnap = await db.collection("changes")
        .where("userId", "==", uid)
        .where("detectedAt", ">", admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .get();

      const unacknowledged = changedSnap.docs
        .map(d => d.data())
        .filter(d => !d.ackStatus && (d.severityLevel === 'HIGH' || d.severityLevel === 'CRITICAL'));

      if (unacknowledged.length === 0 && needsCheck.length === 0) continue;

      const html = `
         <h3>Weekly Digest</h3>
         <p>${unacknowledged.length} critical changes pending review.</p>
         <ul>${unacknowledged.slice(0, 5).map(c => `<li>${c.severityLevel}: ${c.sourceUrl}</li>`).join("")}</ul>
         <p>${needsCheck.length} sources need manual verification.</p>
         <a href="https://deadline-shield-web.web.app/dashboard">View Dashboard</a>
       `;

      await safeSendEmail(user.email, "Weekly Deadline-Shield Digest", "Check your dashboard.", html);
    }
    return null;
  });

