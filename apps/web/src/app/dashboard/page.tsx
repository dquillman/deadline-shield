"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { db, functions } from "../../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, limit, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import Disclaimer from "@/components/Disclaimer";
import { MonitoredSource, PLAN_LIMITS, UserProfile } from "../../lib/types";
import { SettingsMenu } from "@/components/settings-menu";
import { useTheme } from "next-themes";

export default function DashboardPage() {
  const { user } = useAuth();
  const [sources, setSources] = useState<MonitoredSource[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();
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

          // Apply saved theme preference
          if (data.themePreference) {
            setTheme(data.themePreference);
          }

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
    <div className="p-5 max-w-screen-xl mx-auto font-sans bg-white dark:bg-blue-950 dark:text-blue-50 min-h-screen transition-colors duration-300">
      {onboardingStep !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-blue-900 p-8 rounded-xl max-w-md shadow-2xl border dark:border-blue-700">
            {onboardingStep === 1 && (
              <div>
                <h3 className="text-xl font-semibold mb-3 dark:text-blue-100">🎯 What we watch</h3>
                <p className="text-gray-600 dark:text-blue-200 mb-5">We monitor pages that contain deadlines, regulatory changes, or obligations.</p>
                <button onClick={() => setOnboardingStep(2)} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">Next</button>
              </div>
            )}
            {onboardingStep === 2 && (
              <div>
                <h3 className="text-xl font-semibold mb-3 dark:text-blue-100">🔔 How alerts work</h3>
                <p className="text-gray-600 dark:text-blue-200 mb-5">You'll only be notified when something truly matters. We reduce noise so you can focus.</p>
                <button onClick={() => setOnboardingStep(3)} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">Next</button>
              </div>
            )}
            {onboardingStep === 3 && (
              <div>
                <h3 className="text-xl font-semibold mb-3 dark:text-blue-100">🛡️ What Guardian does</h3>
                <p className="text-gray-600 dark:text-blue-200 mb-5">Guardian explains changes and recommends actions like "Update" or "Escalate".</p>
                <button onClick={completeOnboarding} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">Got it</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8 bg-gray-50 dark:bg-blue-900/40 p-4 rounded-xl border border-gray-100 dark:border-blue-800/50">
        <h1 className="text-3xl font-bold dark:text-blue-100 tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-6">
          <div className="text-sm dark:text-blue-200 hidden md:block">
            <span className="bg-gray-200 dark:bg-blue-800 px-3 py-1 rounded-full text-xs font-medium">Plan: <strong className="dark:text-blue-100">{profile?.plan}</strong></span>
            <span className="ml-4">Sources: {sources.length} / {PLAN_LIMITS[profile?.plan || 'Starter']}</span>
          </div>
          <Link href="/changes" className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 hover:underline text-sm font-medium mr-2">View Logs</Link>
          <div className="bg-white dark:bg-blue-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
            <SettingsMenu />
          </div>
        </div>
      </div>

      <div className="bg-gray-100 dark:bg-blue-900/50 p-6 rounded-xl my-6 border border-transparent dark:border-blue-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-blue-50 flex items-center gap-2">
          <span className="text-xl">➕</span> Add New Source
        </h3>
        {error && <p className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 p-3 rounded-lg mb-4 text-sm border border-red-200 dark:border-red-800">{error}</p>}
        <form onSubmit={handleAddSource} className="flex gap-3 flex-wrap">
          <input
            placeholder="Name (e.g. PMI Exam Updates)"
            value={newSource.name}
            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
            required
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg border border-gray-300 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-all placeholder-gray-400 dark:placeholder-blue-400/50"
          />
          <input
            placeholder="URL (https://...)"
            type="url"
            value={newSource.url}
            onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
            required
            className="flex-[2] min-w-[300px] px-4 py-2.5 rounded-lg border border-gray-300 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-all placeholder-gray-400 dark:placeholder-blue-400/50"
          />
          <select
            value={newSource.frequency}
            onChange={(e) => setNewSource({ ...newSource, frequency: e.target.value })}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none cursor-pointer"
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
          </select>
          <button type="submit" disabled={adding} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-lg transition-colors">
            {adding ? 'Adding...' : 'Add Source'}
          </button>
        </form>
      </div>

      {unacknowledgedCount === 0 && sources.length > 0 && (
        <div className="bg-green-50 dark:bg-blue-900/30 border border-green-200 dark:border-blue-600 text-green-700 dark:text-blue-200 p-3 rounded-lg mb-5 flex items-center gap-2 text-sm">
          <span>🛡️</span> All monitored deadlines are currently under control.
        </div>
      )}

      <div className="overflow-hidden bg-white dark:bg-blue-900/20 rounded-xl shadow-sm border border-gray-200 dark:border-blue-800">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-blue-800 bg-gray-50/50 dark:bg-blue-900/40">
              <th className="p-5 font-semibold text-gray-700 dark:text-blue-200">Source</th>
              <th className="p-5 font-semibold text-gray-700 dark:text-blue-200">
                Status
                <div className="text-xs text-gray-500 dark:text-blue-400 font-normal mt-0.5">Guardian explains why changes matter</div>
              </th>
              <th className="p-5 font-semibold text-gray-700 dark:text-blue-200">Last Check</th>
              <th className="p-5 font-semibold text-gray-700 dark:text-blue-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td colSpan={4} className="p-12 text-center text-gray-500 dark:text-blue-300">
                  <div className="text-4xl mb-3 opacity-80">🔭</div>
                  <div className="text-xl font-medium mb-2 text-gray-700 dark:text-blue-200">No sources added yet.</div>
                  <div className="text-sm opacity-80">Deadline Shield is watching quietly. Add a URL above to begin.</div>
                </td>
              </tr>
            )}
            {sources.length > 0 && sources.filter(s => s.lastStatus === 'Changed').length === 0 && (
              <tr>
                <td colSpan={4} className="p-12 text-center text-gray-500 dark:text-blue-300">
                  <div className="text-4xl mb-3 opacity-80">✅</div>
                  <div className="text-lg font-medium mb-1 text-gray-700 dark:text-blue-200">No recent changes detected.</div>
                  <div className="text-sm opacity-80">Everything is stable. We'll alert you if deadlines move.</div>
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
                  className="hover:bg-gray-50 dark:hover:bg-blue-900/30 transition-colors border-b border-gray-100 dark:border-blue-800/50 last:border-0"
                  style={{ opacity: source.ackStatus ? 0.6 : 1, filter: source.ackStatus ? 'grayscale(50%)' : 'none' }}
                >
                  <td className="px-6 py-5">
                    <div className="font-medium text-gray-900 dark:text-blue-50 text-lg mb-0.5">{source.name}</div>
                    <div className="text-sm text-gray-500 dark:text-blue-300 truncate max-w-xs font-mono opacity-80" title={source.url}>{source.url}</div>
                    {source.confidenceLevel === 'HIGH' && (
                      <div className="text-xs text-teal-600 dark:text-cyan-400 flex items-center gap-1 mt-2 font-medium bg-teal-50 dark:bg-cyan-950/30 px-2 py-0.5 rounded-full w-fit">
                        🛡️ Historically Stable
                      </div>
                    )}
                    <div className="text-xs flex gap-2 mt-2">
                      {source.manualOnly && <span className="bg-gray-800 dark:bg-blue-950 border border-gray-700 dark:border-blue-800 text-white dark:text-blue-200 px-2 py-0.5 rounded shadow-sm">MANUAL</span>}
                      {source.watchMode && <span className="bg-gray-200 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-0.5 rounded border border-transparent dark:border-blue-800">{source.watchMode}</span>}
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
