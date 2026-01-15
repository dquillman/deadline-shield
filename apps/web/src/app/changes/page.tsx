"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import Link from "next/link";
import Disclaimer from "@/components/Disclaimer";
import { ChangeLog } from "@/lib/types";

export default function ChangesPage() {
    const { user, loading } = useAuth();
    const [changes, setChanges] = useState<ChangeLog[]>([]);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchChanges = async () => {
            try {
                const q = query(
                    collection(db, "changes"),
                    where("userId", "==", user.uid),
                    orderBy("detectedAt", "desc"),
                    limit(50)
                );
                const snapshot = await getDocs(q);
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChangeLog));
                setChanges(items);
            } catch (err) {
                console.error(err);
            } finally {
                setFetching(false);
            }
        };
        fetchChanges();
    }, [user]);

    if (loading) return <p>Loading...</p>;
    if (!user) return <div style={{ padding: 20 }}><Link href="/auth/login">Please Login</Link></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Change Logs</h1>
                <Link href="/dashboard" style={{ color: 'blue' }}>← Back to Dashboard</Link>
            </div>

            {fetching ? <p>Loading changes...</p> : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {changes.map(log => (
                        <li key={log.id} style={{ border: '1px solid #ddd', margin: '10px 0', padding: 15, borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                <strong>
                                    <a href={log.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'blue' }}>
                                        Source Link
                                    </a>
                                </strong>
                                <span style={{ color: '#666', fontSize: '0.9em' }}>
                                    {log.detectedAt ? new Date(log.detectedAt.seconds * 1000).toLocaleString() : 'Unknown Date'}
                                </span>
                            </div>

                            {log.severity && (
                                <div style={{ marginBottom: 8 }}>
                                    <span style={{
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: '0.8em',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        backgroundColor: log.severity === 'CRITICAL' ? 'red' :
                                            log.severity === 'HIGH' ? 'orange' :
                                                log.severity === 'MEDIUM' ? '#DAA520' : 'green'
                                    }}>
                                        {log.severity} ({log.score}/100)
                                    </span>
                                    {log.scoreReasons && log.scoreReasons.length > 0 && (
                                        <span style={{ marginLeft: 10, fontSize: '0.9em', color: '#555' }}>
                                            Detected: {log.scoreReasons.join(', ')}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div style={{ background: '#f9f9f9', padding: 10, borderRadius: 4, fontFamily: 'monospace', fontSize: '0.9em' }}>
                                {log.diffSummary}
                            </div>
                        </li>
                    ))}
                    {changes.length === 0 && <p style={{ color: '#666' }}>No changes detected yet.</p>}
                </ul>
            )}

            <Disclaimer />
        </div>
    );
}
