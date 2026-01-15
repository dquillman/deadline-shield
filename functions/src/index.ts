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
const calculateImportance = (text: string): { score: number, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  const lowerText = text.toLowerCase();

  // Heuristic 1: Urgency Keywords (+20 points each, max 60)
  const urgencyKeywords = ['deadline', 'due date', 'compliance', 'penalty', 'enforcement', 'required', 'mandatory', 'effective date'];
  let keywordHits = 0;
  for (const keyword of urgencyKeywords) {
    if (lowerText.includes(keyword)) {
      score += 20;
      keywordHits++;
      if (!reasons.includes('Urgency keywords detected')) {
        reasons.push('Urgency keywords detected');
      }
    }
  }
  // Cap keyword score contribution
  if (keywordHits > 3) score = Math.min(score, 60);

  // Heuristic 2: Date Patterns (+30 points)
  // Simple regex for common date formats (YYYY-MM-DD, Month DD, YYYY, etc.) - heuristic only
  const dateRegex = /(\d{4}-\d{2}-\d{2})|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i;
  if (dateRegex.test(text)) {
    score += 30;
    reasons.push('Dates detected in content');
  }

  // Heuristic 3: Explicit Status Keywords (+40 points)
  const statusKeywords = ['urgent', 'immediate action', 'critical', 'warning'];
  for (const keyword of statusKeywords) {
    if (lowerText.includes(keyword)) {
      score += 40;
      reasons.push(`High-priority keyword: "${keyword}"`);
      break; // One is enough to boost
    }
  }

  // Normalize Score (0-100)
  score = Math.min(score, 100);

  // Determine Severity
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (score >= 80) severity = 'CRITICAL';
  else if (score >= 50) severity = 'HIGH';
  else if (score >= 20) severity = 'MEDIUM';

  return { score, severity, reasons };
};

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


// --- Hardened Change Detection Engine ---
export const checkDeadlineUpdates = functions.pubsub.schedule('every day 06:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log("Starting Hardened Change Detection Scan...");

    // Hardening: Skip manualOnly sources effectively
    const sourcesSnap = await db.collection("sources").get();

    const updates: Promise<any>[] = [];

    for (const doc of sourcesSnap.docs) {
      const source = doc.data();
      const sourceId = doc.id;

      // Hardening 2: Skip if Manual Only or Blocked
      if (source.manualOnly) {
        console.log(`Skipping Manual Only source: ${source.name}`);
        continue;
      }

      updates.push((async () => {
        try {
          const response = await fetch(source.url);

          // Hardening 2: 403 Handling
          if (response.status === 403) {
            const newCount = (source.consecutive403 || 0) + 1;
            console.warn(`403 detected for ${source.name} (Count: ${newCount})`);

            if (newCount >= 3) {
              // Block Source
              await db.collection("sources").doc(sourceId).update({
                lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
                lastStatus: "Blocked - Manual Verification Required",
                consecutive403: newCount,
                manualOnly: true,
                lastError: "Blocked by Firewall (403)",
              });
            } else {
              // Increment Count
              await db.collection("sources").doc(sourceId).update({
                lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
                consecutive403: newCount,
                lastStatus: "Error",
              });
            }
            return;
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          // Reset 403 count on success
          const html = await response.text();
          const normalized = normalizeContent(html);
          const newHash = computeHash(normalized);

          if (source.lastHash && source.lastHash !== newHash) {
            console.log(`Change detected for ${source.name}`);

            // Awesome Mode: Calculate Importance
            const { score, severity, reasons } = calculateImportance(normalized);

            const changeData = {
              sourceId,
              userId: source.userId,
              detectedAt: admin.firestore.FieldValue.serverTimestamp(),
              diffSummary: "Content changed.",
              sourceUrl: source.url,
              score,
              severity,
              scoreReasons: reasons
            };
            await db.collection("changes").add(changeData);

            // Fetch User for Email
            const userSnap = await db.collection("users").doc(source.userId).get();
            const user = userSnap.data();

            // Safe Email Alert with Severity
            let emailError = null;
            if (user?.plan !== 'Starter') {
              const emoji = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '🔴' : severity === 'MEDIUM' ? '🟠' : '🟢';
              const subject = `${emoji} [${severity}] Change Detected: ${source.name}`;

              const res = await safeSendEmail(
                user?.email,
                subject,
                `Check dashboard: ${source.url}`,
                `<p>Change detected. <strong>Severity: ${severity} (${score}/100)</strong></p><p><a href="${source.url}">Source</a></p>`
              );
              if (res?.error) emailError = res.error;
            }

            // Update Source
            await db.collection("sources").doc(sourceId).update({
              lastChecked: admin.firestore.FieldValue.serverTimestamp(),
              lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
              lastStatus: "Changed",
              lastHash: newHash,
              consecutive403: 0,
              consecutiveFailures: 0,
              lastError: null,
              lastEmailError: emailError,
              lastChangeScore: score,
              lastChangeSeverity: severity
            });

          } else {
            // No Change
            await db.collection("sources").doc(sourceId).update({
              lastChecked: admin.firestore.FieldValue.serverTimestamp(),
              lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
              lastStatus: source.lastStatus?.includes("Blocked") ? source.lastStatus : "No Change",
              lastHash: newHash,
              consecutive403: 0,
              consecutiveFailures: 0,
              lastError: null
            });
          }

        } catch (err: any) {
          console.error(`Error checking ${source.name}:`, err);

          // Hardening 6: Failure Counting
          const failures = (source.consecutiveFailures || 0) + 1;
          await db.collection("sources").doc(sourceId).update({
            lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
            lastStatus: "Error",
            lastError: err.message,
            consecutiveFailures: failures
          });
        }
      })());
    }

    await Promise.all(updates);
    return null;
  });

// --- Hardening 3: Manual Verification Workflow (Weekly trigger) ---
export const triggerWeeklyManualCheck = functions.pubsub.schedule('every sunday 09:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    // Find all manualOnly sources
    const snapshot = await db.collection("sources").where("manualOnly", "==", true).get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        needsCheck: true,
        lastStatus: "Needs Manual Verification"
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

      const changed = sourcesSnap.docs.filter(d => d.data().lastStatus === "Changed");
      const needsCheck = sourcesSnap.docs.filter(d => d.data().needsCheck === true);

      if (changed.length === 0 && needsCheck.length === 0) continue;

      const html = `
         <h3>Weekly Digest</h3>
         <p>${changed.length} sources updated.</p>
         <p>${needsCheck.length} sources need manual verification.</p>
         <a href="https://deadline-shield-web.web.app/dashboard">View Dashboard</a>
       `;

      await safeSendEmail(user.email, "Weekly Deadline-Shield Digest", "Check your dashboard.", html);
    }
    return null;
  });

