"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { db, functions } from "../../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, limit, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import Disclaimer from "@/components/Disclaimer";
import { MonitoredSource, PLAN_LIMITS, UserProfile } from "../../lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [sources, setSources] = useState<MonitoredSource[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSource, setNewSource] = useState({ name: "", url: "", frequency: "Daily" });
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  // Phase 3 UI States
  const [verifyingSource, setVerifyingSource] = useState<MonitoredSource | null>(null);
  const [verifyReason, setVerifyReason] = useState<string>("EXPECTED_CHANGE");
  const [verifyNote, setVerifyNote] = useState("");

  const [pausingSource, setPausingSource] = useState<MonitoredSource | null>(null);
  const [pauseReason, setPauseReason] = useState<string>("TEMPORARY");
  const [pauseNote, setPauseNote] = useState("");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProfileAndSources = async () => {
      const userRef = doc(db, "users", user.uid);
      const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          if (data.onboardingComplete === false || data.onboardingComplete === undefined) {
            setOnboardingStep(1);
          }
        } else {
          // Handle case where user profile doesn't exist yet
          setProfile({ plan: 'Starter', onboardingComplete: false } as UserProfile); // Default profile
          setOnboardingStep(1);
        }
        setLoading(false);
      });

      const q = query(collection(db, "sources"), where("userId", "==", user.uid));
      const unsubscribeSources = onSnapshot(q, (snapshot) => {
        const items: MonitoredSource[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as MonitoredSource);
        });
        setSources(items);
      });

      return () => {
        unsubscribeProfile();
        unsubscribeSources();
      };
    };

    fetchProfileAndSources();
  }, [user]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAdding(true);
    if (!user) return;

    try {
      // Use Callable Function for Server-Side Tier Enforcement
      const createSourceFn = httpsCallable(functions, 'createSource');
      await createSourceFn({
        name: newSource.name,
        url: newSource.url,
        frequency: newSource.frequency
      });

      setNewSource({ name: "", url: "", frequency: "Daily" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, "sources", id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMarkVerified = async (source: MonitoredSource) => {
    setVerifyingSource(source);
    setVerifyReason("EXPECTED_CHANGE");
    setVerifyNote("");
  };

  const commitMarkVerified = async () => {
    if (!verifyingSource?.id || !user) return;
    try {
      const snap = {
        watchMode: verifyingSource.watchMode || 'FullContent',
        title: (verifyingSource as any).lastTitle || "",
        metaDescription: (verifyingSource as any).lastMetaDescription || "",
        contentSample: (verifyingSource as any).lastContentSample || "",
        url: verifyingSource.url
      };

      await updateDoc(doc(db, "sources", verifyingSource.id), {
        needsCheck: false,
        lastStatus: "OK",
        status: "OK",
        lastVerifiedAt: serverTimestamp(),
        verifiedAt: serverTimestamp(),
        verifiedBy: user.uid,
        verifiedReason: verifyReason,
        verifiedNote: verifyNote,
        verifiedHash: verifyingSource.lastHash || null,
        verifiedFingerprint: snap,
        consecutiveFailures: 0,
        backoffLevel: 0
      });

      await addDoc(collection(db, "audit_logs"), {
        userId: user.uid,
        action: "MANUAL_VERIFY",
        sourceId: verifyingSource.id,
        sourceName: verifyingSource.name,
        timestamp: serverTimestamp(),
        verifiedHash: verifyingSource.lastHash || null,
        verifiedReason: verifyReason,
        sourceSnapshot: snap,
        details: verifyNote || `Manually verified as ${verifyReason}`
      });

      setVerifyingSource(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handlePause = (source: MonitoredSource) => {
    setPausingSource(source);
    setPauseReason("TEMPORARY");
    setPauseNote("");
  };

  const handleAcknowledge = async (sourceId: string, ackStatus: string) => {
    try {
      // Find the most recent change for this source to acknowledge
      // In a real app we might pass the changeId directly, but for this simple dashboard
      // we'll assume the user is acknowledging the current 'Changed' state of the source.
      const changesSnap = await getDocs(query(
        collection(db, 'changes'),
        where('sourceId', '==', sourceId),
        orderBy('detectedAt', 'desc'),
        limit(1)
      ));

      if (changesSnap.empty) return;
      const changeId = changesSnap.docs[0].id;

      const acknowledgeChange = httpsCallable(functions, 'acknowledgeChange');
      await acknowledgeChange({ changeId, ackStatus });

      // Update local state for immediate feedback
      setSources(sources.map(s => s.id === sourceId ? { ...s, ackStatus: ackStatus as any } : s));
    } catch (error) {
      console.error("Error acknowledging change:", error);
    }
  };

  const commitPause = async () => {
    if (!pausingSource?.id || !user) return;
    try {
      await updateDoc(doc(db, "sources", pausingSource.id), {
        status: "PAUSED",
        lastStatus: "PAUSED",
        pausedAt: serverTimestamp(),
        pausedBy: user.uid,
        pauseReason: pauseReason,
        nextCheckAt: null
      });

      await addDoc(collection(db, "audit_logs"), {
        userId: user.uid,
        action: "PAUSE_SOURCE",
        sourceId: pausingSource.id,
        sourceName: pausingSource.name,
        timestamp: serverTimestamp(),
        details: `Paused: ${pauseReason}. ${pauseNote}`
      });

      setPausingSource(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const isGuardianEnabled = profile?.plan === 'Pro' || profile?.plan === 'Enterprise';

  const completeOnboarding = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        onboardingComplete: true
      });
      setOnboardingStep(null);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const unacknowledgedCount = sources.filter(s => s.lastStatus === 'Changed' && !s.ackStatus).length;

  const handleResume = async (source: MonitoredSource) => {
    if (!source.id || !user) return;
    if (!confirm(`Resume monitoring for ${source.name}?`)) return;
    try {
      await updateDoc(doc(db, "sources", source.id), {
        status: "OK",
        lastStatus: "No Change", // Reset to neutral
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        nextCheckAt: serverTimestamp() // Check soon
      });

      await addDoc(collection(db, "audit_logs"), {
        userId: user.uid,
        action: "RESUME_SOURCE",
        sourceId: source.id,
        sourceName: source.name,
        timestamp: serverTimestamp(),
        details: "User manually resumed source."
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading Guardian...</div>;
  if (!user) return <div style={{ padding: 20 }}><Link href="/auth/login">Please Login</Link></div>;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif" }}>
      {onboardingStep !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            {onboardingStep === 1 && (
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>🎯 What we watch</h3>
                <p style={{ color: '#4a5568', marginBottom: '20px' }}>We monitor pages that contain deadlines, regulatory changes, or obligations.</p>
                <button onClick={() => setOnboardingStep(2)} style={{ background: '#0070f3', color: 'white', padding: '8px 16px', borderRadius: '6px' }}>Next</button>
              </div>
            )}
            {onboardingStep === 2 && (
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>🔔 How alerts work</h3>
                <p style={{ color: '#4a5568', marginBottom: '20px' }}>You’ll only be notified when something truly matters. We reduce noise so you can focus.</p>
                <button onClick={() => setOnboardingStep(3)} style={{ background: '#0070f3', color: 'white', padding: '8px 16px', borderRadius: '6px' }}>Next</button>
              </div>
            )}
            {onboardingStep === 3 && (
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>🛡️ What Guardian does</h3>
                <p style={{ color: '#4a5568', marginBottom: '20px' }}>Guardian explains changes and recommends actions like "Update" or "Escalate".</p>
                <button onClick={completeOnboarding} style={{ background: '#0070f3', color: 'white', padding: '8px 16px', borderRadius: '6px' }}>Got it</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <h1>Dashboard</h1>
        <div>
          <span>Plan: <strong>{profile?.plan}</strong></span>
          <span style={{ marginLeft: 15 }}>Sources: {sources.length} / {PLAN_LIMITS[profile?.plan || 'Starter']}</span>
          <Link href="/changes" style={{ marginLeft: 20, color: 'blue' }}>View Change Logs</Link>
        </div>
      </div>

      <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, margin: '20px 0' }}>
        <h3>Add New Source</h3>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handleAddSource} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            placeholder="Name (e.g. PMI Exam Updates)"
            value={newSource.name}
            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
            required
            style={{ padding: 8, flex: 1 }}
          />
          <input
            placeholder="URL (https://...)"
            type="url"
            value={newSource.url}
            onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
            required
            style={{ padding: 8, flex: 2 }}
          />
          <select
            value={newSource.frequency}
            onChange={(e) => setNewSource({ ...newSource, frequency: e.target.value })}
            style={{ padding: 8 }}
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
          </select>
          <button type="submit" disabled={adding} style={{ padding: '8px 16px', background: '#0070f3', color: 'white', border: 'none', borderRadius: 4 }}>
            {adding ? 'Adding...' : 'Add Source'}
          </button>
        </form>
      </div>

      {unacknowledgedCount === 0 && sources.length > 0 && (
        <div style={{ background: '#f0fff4', border: '1px solid #c6f6d5', color: '#2f855a', padding: '12px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95em' }}>
          <span>🛡️</span> All monitored deadlines are currently under control.
        </div>
      )}

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', background: '#f9f9f9' }}>
              <th style={{ padding: 15 }}>Source</th>
              <th style={{ padding: 15 }}>
                Status
                <div style={{ fontSize: '0.7em', color: '#666', fontWeight: 'normal' }}>Guardian explains why changes matter</div>
              </th>
              <th style={{ padding: 15 }}>Last Check</th>
              <th style={{ padding: 15 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#718096' }}>
                  <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>No sources added yet.</div>
                  <div style={{ fontSize: '0.9em' }}>Deadline Shield is watching quietly. Add a URL to begin.</div>
                </td>
              </tr>
            )}
            {sources.length > 0 && sources.filter(s => s.lastStatus === 'Changed').length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#718096' }}>
                  <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>No recent changes detected.</div>
                  <div style={{ fontSize: '0.9em' }}>Everything is stable. We'll alert you if deadlines move.</div>
                </td>
              </tr>
            )}
            {sources.map(source => {
              const statusColor =
                source.status === 'PAUSED' ? '#666' :
                  source.status === 'DEGRADED' ? 'orange' :
                    source.lastStatus === 'Changed' ? 'red' :
                      source.lastStatus === 'Error' ? 'orange' :
                        source.lastStatus?.includes('Blocked') ? 'darkred' :
                          source.lastStatus?.includes('Needs') ? '#b8860b' :
                            'green';

              return (
                <tr
                  key={source.id}
                  className="hover:bg-gray-50 transition-colors"
                  style={{ opacity: source.ackStatus ? 0.6 : 1, filter: source.ackStatus ? 'grayscale(50%)' : 'none' }}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{source.name}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs" title={source.url}>{source.url}</div>
                    {source.confidenceLevel === 'HIGH' && (
                      <div style={{ fontSize: '0.65em', color: '#2c7a7b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        🛡️ Historically Stable
                      </div>
                    )}
                    <div style={{ fontSize: '0.7em', display: 'flex', gap: 5, marginTop: 4 }}>
                      {source.manualOnly && <span style={{ background: '#333', color: 'white', padding: '2px 4px', borderRadius: 3 }}>MANUAL</span>}
                      {source.watchMode && <span style={{ background: '#eee', padding: '2px 4px', borderRadius: 3 }}>{source.watchMode}</span>}
                    </div>
                  </td>
                  <td style={{ padding: 10 }}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'blue', textDecoration: 'underline' }}>
                      Link
                    </a>
                  </td>
                  <td style={{ padding: 10 }}>{source.frequency}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ color: statusColor, fontWeight: 'bold' }}>
                      {source.status || source.lastStatus}
                    </span>
                    {source.status === 'DEGRADED' && (
                      <div style={{ fontSize: '0.7em', color: 'orange' }}>Backoff Lvl: {source.backoffLevel}</div>
                    )}
                    {source.lastStatus === 'Changed' && (source.severityLevel || source.lastChangeSeverity) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span
                          title={source.severityReasons?.join('\n')}
                          style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: '0.8em',
                            color: 'white',
                            cursor: source.severityReasons ? 'help' : 'default',
                            backgroundColor: (source.severityLevel || source.lastChangeSeverity) === 'CRITICAL' ? 'red' :
                              (source.severityLevel || source.lastChangeSeverity) === 'HIGH' ? 'orange' :
                                (source.severityLevel || source.lastChangeSeverity) === 'MEDIUM' ? '#DAA520' : 'green'
                          }}>
                          {source.severityLevel || source.lastChangeSeverity}
                        </span>

                        {isGuardianEnabled && source.actionCategory && !source.ackStatus && (
                          <span
                            title={`${source.actionGuidance}\n\nConfidence: ${source.actionConfidence}${source.confidenceNotes?.length ? `\nNote: ${source.confidenceNotes.join(' ')}` : ''}`}
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.8em',
                              fontWeight: 'bold',
                              border: '1px solid',
                              cursor: 'help',
                              color: source.actionCategory === 'ESCALATE' ? '#721c24' : source.actionCategory === 'UPDATE' ? '#856404' : source.actionCategory === 'REVIEW' ? '#0c5460' : '#155724',
                              backgroundColor: source.actionCategory === 'ESCALATE' ? '#f8d7da' : source.actionCategory === 'UPDATE' ? '#fff3cd' : source.actionCategory === 'REVIEW' ? '#d1ecf1' : '#d4edda',
                              borderColor: source.actionCategory === 'ESCALATE' ? '#f5c6cb' : source.actionCategory === 'UPDATE' ? '#ffeeba' : source.actionCategory === 'REVIEW' ? '#bee5eb' : '#c3e6cb'
                            }}
                          >
                            {source.actionCategory === 'ESCALATE' ? '🚨 ESCALATE' : source.actionCategory === 'UPDATE' ? '📝 UPDATE' : source.actionCategory === 'REVIEW' ? '🔍 REVIEW' : '✅ NO ACTION'}
                          </span>
                        )}

                        {!isGuardianEnabled && source.lastStatus === 'Changed' && (
                          <span
                            style={{ fontSize: '0.7em', color: '#666', fontStyle: 'italic', border: '1px dashed #ccc', padding: '1px 4px', borderRadius: '4px' }}
                            title="Upgrade to Pro for Guardian Action Guidance"
                          >
                            🔒 Guardian Preview
                          </span>
                        )}

                        {source.ackStatus && (
                          <span style={{ fontSize: '0.75em', color: '#666', fontStyle: 'italic' }}>
                            ✅ Resolved ({source.ackStatus.replace('ACK_', '')})
                          </span>
                        )}
                      </div>
                    )}

                    {source.nextDeadline && (
                      <div style={{ marginTop: 4, fontSize: '0.8em', color: '#d9534f', fontWeight: 'bold' }}>
                        ⏳ Next Deadline: {new Date(source.nextDeadline.seconds * 1000).toLocaleDateString()}
                        <span style={{ marginLeft: 6, fontSize: '0.9em', fontWeight: 'normal' }}>
                          ({Math.ceil((source.nextDeadline.toMillis() - Date.now()) / (1000 * 60 * 60 * 24))}d left)
                        </span>
                      </div>
                    )}

                    {source.verifiedAt && (
                      <div style={{ marginTop: 4, fontSize: '0.75em', background: '#e6fffa', border: '1px solid #b2f5ea', color: '#2c7a7b', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }} title={`Verified by ${source.verifiedBy}: ${source.verifiedNote}`}>
                        ✅ Verified ({source.verifiedReason})
                      </div>
                    )}

                    {source.lastChecked && <div style={{ fontSize: '0.8em', color: '#666', marginTop: 4 }}>Checked: {new Date(source.lastChecked.seconds * 1000).toLocaleDateString()}</div>}
                    {source.nextCheckAt && source.status !== 'PAUSED' && (
                      <div style={{ fontSize: '0.7em', color: '#888' }}>Next: {new Date(source.nextCheckAt.seconds * 1000).toLocaleTimeString()}</div>
                    )}

                    {source.needsCheck && (
                      <div style={{ marginTop: 5 }}>
                        <button
                          onClick={() => handleMarkVerified(source)}
                          style={{ fontSize: '0.8em', background: 'green', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: 4 }}
                        >
                          Verify Change
                        </button>
                      </div>
                    )}
                    {source.lastError && (
                      <div style={{ color: 'red', fontSize: '0.75em', marginTop: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={source.lastError}>
                        Err: {source.lastError}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {source.status === 'PAUSED' ? (
                        <button onClick={() => handleResume(source)} style={{ color: 'green', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9em' }}>Resume</button>
                      ) : (
                        <button onClick={() => handlePause(source)} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9em' }}>Pause</button>
                      )}
                      <button onClick={() => source.id && handleDelete(source.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9em' }}>Delete</button>
                    </div>
                    {source.lastStatus === 'Changed' && !source.ackStatus && (
                      <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Action Hub</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => source.id && handleAcknowledge(source.id, 'ACK_REVIEWED')}
                            className="text-xs px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Mark Reviewed
                          </button>
                          {source.actionCategory === 'UPDATE' && (
                            <button
                              onClick={() => source.id && handleAcknowledge(source.id, 'ACK_UPDATED')}
                              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Updated Timeline
                            </button>
                          )}
                          {source.actionCategory === 'NO_ACTION' && (
                            <button
                              onClick={() => source.id && handleAcknowledge(source.id, 'ACK_NO_ACTION')}
                              className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                            >
                              Not Relevant
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* --- Phase 3 Dialogs --- */}

        {verifyingSource && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: 30, borderRadius: 8, width: 400 }}>
              <h3>Verify Snapshot</h3>
              <p>You are marking the latest change as <strong>OK</strong>.</p>

              <label style={{ display: 'block', marginBottom: 10 }}>
                Reason:
                <select value={verifyReason} onChange={(e) => setVerifyReason(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 5 }}>
                  <option value="EXPECTED_CHANGE">Expected Change</option>
                  <option value="FALSE_POSITIVE">False Positive</option>
                  <option value="BLOCKED_BUT_OK">Blocked But OK</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 20 }}>
                Notes (optional):
                <textarea
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  placeholder="Why is this change OK?"
                  maxLength={300}
                  style={{ width: '100%', padding: 8, marginTop: 5, height: 80 }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setVerifyingSource(null)} style={{ padding: '8px 16px' }}>Cancel</button>
                <button onClick={commitMarkVerified} style={{ padding: '8px 16px', background: 'green', color: 'white', border: 'none', borderRadius: 4 }}>Verify & Save</button>
              </div>
            </div>
          </div>
        )}

        {pausingSource && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', padding: 30, borderRadius: 8, width: 400 }}>
              <h3>Pause Monitoring</h3>

              <label style={{ display: 'block', marginBottom: 10 }}>
                Reason:
                <select value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 5 }}>
                  <option value="TEMPORARY">Temporary Pause</option>
                  <option value="TOO_NOISY">Too Noisy</option>
                  <option value="BLOCKED_SITE">Site is Blocked</option>
                  <option value="NOT_NEEDED">Not Needed Right Now</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 20 }}>
                Notes (optional):
                <textarea
                  value={pauseNote}
                  onChange={(e) => setPauseNote(e.target.value)}
                  placeholder="Additional context..."
                  maxLength={300}
                  style={{ width: '100%', padding: 8, marginTop: 5, height: 60 }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setPausingSource(null)} style={{ padding: '8px 16px' }}>Cancel</button>
                <button onClick={commitPause} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: 4 }}>Pause Monitor</button>
              </div>
            </div>
          </div>
        )}

        <Disclaimer />
      </div>
    </div>
  );
}
