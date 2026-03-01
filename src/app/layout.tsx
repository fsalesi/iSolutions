import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleFromAuth } from "@/context/LocaleFromAuth";
import "./globals.css";

export const metadata: Metadata = {
  title: "iSolutions",
  description: "Enterprise procurement platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to set theme before paint — prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var t = localStorage.getItem('isolutions-theme');
                if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', t);
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <LocaleFromAuth>
              {children}
            </LocaleFromAuth>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
