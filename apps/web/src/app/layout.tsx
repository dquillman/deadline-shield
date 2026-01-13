import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Deadline Shield",
  description: "Never miss a landlord deadline again."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
