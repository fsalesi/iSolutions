import type { Metadata } from "next";
import { SessionProvider } from "@/context/SessionContext";
import { LocaleFromAuth } from "@/context/LocaleFromAuth";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = { title: "iSolutions" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
