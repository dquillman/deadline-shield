import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  title: "Deadline Shield",
  description: "Never miss a compliance change.",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Navbar />
            <main style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
