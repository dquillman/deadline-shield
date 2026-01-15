"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { db, functions } from "../../lib/firebase";
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Link from "next/link";
import Disclaimer from "@/components/Disclaimer";
import { MonitoredSource, PLAN_LIMITS } from "../../lib/types";

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const [sources, setSources] = useState<MonitoredSource[]>([]);
  const [newSource, setNewSource] = useState({ name: "", url: "", frequency: "Daily" });
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sources"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: MonitoredSource[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MonitoredSource);
      });
      setSources(items);
    });
    return () => unsubscribe();
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

  const handleMarkVerified = async (id: string) => {
    if (!confirm("Confirm you have manually verified this source?")) return;
    try {
      await updateDoc(doc(db, "sources", id), {
        needsCheck: false,
        lastStatus: "Verified",
        lastVerifiedAt: serverTimestamp(),
        consecutiveFailures: 0 // Reset failures on manual confirm
      });
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <div style={{ padding: 20 }}><Link href="/auth/login">Please Login</Link></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
        <thead>
          <tr style={{ background: '#eee', textAlign: 'left' }}>
            <th style={{ padding: 10 }}>Name</th>
            <th style={{ padding: 10 }}>URL</th>
            <th style={{ padding: 10 }}>Frequency</th>
            <th style={{ padding: 10 }}>Last Status</th>
            <th style={{ padding: 10 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(source => {
            const statusColor =
              source.lastStatus === 'Changed' ? 'red' :
                source.lastStatus === 'Error' ? 'orange' :
                  source.lastStatus?.includes('Blocked') ? 'darkred' :
                    source.lastStatus?.includes('Needs') ? '#b8860b' /* Dark GoldenRod */ :
                      'green';

            return (
              <tr key={source.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: 10 }}>
                  {source.name}
                  {source.manualOnly && <span style={{ fontSize: '0.7em', background: '#333', color: 'white', padding: '2px 4px', borderRadius: 3, marginLeft: 5 }}>MANUAL</span>}
                </td>
                <td style={{ padding: 10 }}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'blue', textDecoration: 'underline' }}>
                    Link
                  </a>
                </td>
                <td style={{ padding: 10 }}>{source.frequency}</td>
                <td style={{ padding: 10 }}>
                  <span style={{ color: statusColor, fontWeight: 'bold' }}>
                    {source.lastStatus}
                  </span>
                  {source.lastStatus === 'Changed' && source.lastChangeSeverity && (
                    <span style={{
                      marginLeft: 8,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: '0.8em',
                      color: 'white',
                      backgroundColor: source.lastChangeSeverity === 'CRITICAL' ? 'red' :
                        source.lastChangeSeverity === 'HIGH' ? 'orange' :
                          source.lastChangeSeverity === 'MEDIUM' ? '#DAA520' : 'green'
                    }}>
                      {source.lastChangeSeverity} ({source.lastChangeScore})
                    </span>
                  )}
                  {source.lastChecked && <div style={{ fontSize: '0.8em', color: '#666' }}>Checked: {new Date(source.lastChecked.seconds * 1000).toLocaleDateString()}</div>}

                  {source.needsCheck && (
                    <div style={{ marginTop: 5 }}>
                      <button
                        onClick={() => source.id && handleMarkVerified(source.id)}
                        style={{ fontSize: '0.8em', background: 'green', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: 4 }}
                      >
                        Mark Verified
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ padding: 10 }}>
                  <button onClick={() => source.id && handleDelete(source.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            );
          })}
          {sources.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#666' }}>No sources monitored yet. Add one above.</td>
            </tr>
          )}
        </tbody>
      </table>

      <Disclaimer />
    </div>
  );
}
