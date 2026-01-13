import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1>Deadline Shield</h1>
      <p>Landlord deadlines, renewals, and “oh crap” recovery — all in one place.</p>
      <ul>
        <li><Link href="/auth">Sign in</Link></li>
        <li><Link href="/dashboard">Go to dashboard</Link></li>
      </ul>
    </div>
  );
}
