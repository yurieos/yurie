import type { Metadata } from "next";
import { Libre_Baskerville, Lora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import 'katex/dist/katex.min.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper";

// Performance: Primary font - preload for fastest LCP
const libreBaskerville = Libre_Baskerville({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: true,
});

// Performance: Secondary font - defer loading
const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

// Performance: Mono font - defer loading (rarely used initially)
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
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
  themeColor: "#2d2621",
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
          libreBaskerville.variable,
          lora.variable,
          ibmPlexMono.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProviderWrapper>
            <main className="h-full">
              {children}
            </main>
            <Toaster />
          </ClerkProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
