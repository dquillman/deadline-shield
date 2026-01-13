import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cheerio from "cheerio";
import * as crypto from "crypto";
import * as sgMail from "@sendgrid/mail";

admin.initializeApp();
const db = admin.firestore();

// Configure SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Helper to normalize content
const normalizeContent = (html: string): string => {
  const $ = cheerio.load(html);
  // Remove scripts, styles, and other non-content elements
  $('script').remove();
  $('style').remove();
  $('noscript').remove();
  $('iframe').remove();
  $('header').remove(); // Often contains dynamic nav
  $('footer').remove(); // Often contains dynamic dates

  // Get text and collapse whitespace
  let text = $.text();
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

// Helper to compute hash
const computeHash = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

// Main Change Detection Function
// Scheduled to run every day at 6:00 AM
export const checkDeadlineUpdates = functions.pubsub.schedule('every day 06:00')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log("Starting Change Detection Scan...");

    // In a real app, we would paginate or use a distributed queue.
    // For MVP, we fetch all active sources.
    const sourcesSnap = await db.collection("sources").get();

    const updates: Promise<any>[] = [];

    for (const doc of sourcesSnap.docs) {
      const source = doc.data();
      const sourceId = doc.id;

      // Basic frequency check (skip if Weekly and not Monday, for example)
      // MVP: Check everything daily if configured as such or just check all for simplicity.
      // Optimizing for "Daily checks" MVP requirement.

      updates.push((async () => {
        try {
          const response = await fetch(source.url);
          const html = await response.text();
          const normalized = normalizeContent(html);
          const newHash = computeHash(normalized);

          if (source.lastHash && source.lastHash !== newHash) {
            console.log(`Change detected for ${source.name} (${sourceId})`);

            // Create Change Log
            const changeData = {
              sourceId,
              userId: source.userId, // Needed for security rules/filtering
              detectedAt: admin.firestore.FieldValue.serverTimestamp(),
              diffSummary: "Content changed. Hash mismatch.", // Simple storage for MVP
              sourceUrl: source.url,
            };
            await db.collection("changes").add(changeData);

            // Update Source
            await db.collection("sources").doc(sourceId).update({
              lastChecked: admin.firestore.FieldValue.serverTimestamp(),
              lastStatus: "Changed",
              lastHash: newHash,
            });

            // Send Alert
            await sendAlert(source, changeData);

          } else {
            console.log(`No change for ${source.name}`);
            // Update Last Checked even if no change
            await db.collection("sources").doc(sourceId).update({
              lastChecked: admin.firestore.FieldValue.serverTimestamp(),
              lastStatus: source.lastStatus === "Error" ? "No Change" : (source.lastStatus || "No Change"),
              lastHash: newHash, // Update hash if it was null
            });
          }

        } catch (err: any) {
          console.error(`Error checking ${source.name}:`, err);
          await db.collection("sources").doc(sourceId).update({
            lastChecked: admin.firestore.FieldValue.serverTimestamp(),
            lastStatus: "Error",
          });
        }
      })());
    }

    await Promise.all(updates);
    console.log("Scan Complete.");
    return null;
  });

const sendAlert = async (source: any, change: any) => {
  if (!SENDGRID_API_KEY) {
    console.log("Skipping email: No SendGrid Key");
    return;
  }

  try {
    // Get User Email
    const userSnap = await db.collection("users").doc(source.userId).get();
    const user = userSnap.data();
    if (!user || !user.email) return;

    // Check Plan for "Email Alerts" feature (Pro/Enterprise only)
    if (user.plan === 'Starter') {
      console.log(`Skipping email for Starter plan user ${source.userId}`);
      return;
    }

    const msg = {
      to: user.email,
      from: 'alerts@deadline-shield.app', // Update with verified sender
      subject: `Change Detected: ${source.name}`,
      text: `A change was detected for ${source.name}.\n\nURL: ${source.url}\nDetected At: ${new Date().toISOString()}\n\nLog into your dashboard to view details.\n\n--\nDisclaimer: Informational monitoring tool. Users responsible for compliance decisions.`,
      html: `
        <h3>Change Detected: ${source.name}</h3>
        <p>We detected a change at the monitored source.</p>
        <p><strong>URL:</strong> <a href="${source.url}">${source.url}</a></p>
        <p><strong>Detected At:</strong> ${new Date().toISOString()}</p>
        <br/>
        <a href="https://deadline-shield-web.web.app/dashboard">View Dashboard</a>
        <hr/>
        <p style="font-size:0.8em; color:#666;">
          DISCLAIMER: This is an informational monitoring tool. Users are responsible for compliance decisions. 
          Links point to original authoritative sources.
        </p>
      `,
    };

    await sgMail.send(msg);
    console.log(`Email sent to ${user.email}`);
  } catch (e) {
    console.error("Error sending email:", e);
  }
};
