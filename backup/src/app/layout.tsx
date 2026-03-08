import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme";
import { SessionProvider } from "@/context/SessionContext";
import { LocaleFromAuth } from "@/context/LocaleFromAuth";
import { ConfirmProvider } from "@/context/ConfirmContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "iSolutions",
  description: "Enterprise procurement platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
          <SessionProvider>
            <LocaleFromAuth>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
            </LocaleFromAuth>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
