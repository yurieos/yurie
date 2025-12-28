import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import 'katex/dist/katex.min.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Yurie",
  description: "An AI-powered search tool powered by Firecrawl and LangGraph",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/yurieapplogo.png",
    apple: "/yurieapplogo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yurie",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-svh overflow-hidden">
      <head />
      <body
        suppressHydrationWarning={true}
        className={cn(
          "h-full overflow-hidden bg-sidebar font-sans antialiased",
          spaceGrotesk.variable
        )}
      >
        <ClerkProviderWrapper>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <main className="h-full">
              {children}
            </main>
            <Toaster />
          </ThemeProvider>
        </ClerkProviderWrapper>
      </body>
    </html>
  );
}
