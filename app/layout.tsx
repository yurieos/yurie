import type { Metadata } from "next";
import { IBM_Plex_Mono, Libre_Baskerville, Lora, Space_Grotesk } from "next/font/google";
import "./globals.css";
import 'katex/dist/katex.min.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
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
    statusBarStyle: "black-translucent",
    title: "Yurie",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e6" },
    { media: "(prefers-color-scheme: dark)", color: "#2d2621" },
  ],
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
          ibmPlexMono.variable,
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
