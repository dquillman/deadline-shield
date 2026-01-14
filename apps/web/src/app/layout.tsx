import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth";

export const metadata = {
  title: "Deadline Shield",
  description: "Never miss a compliance change.",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
