"use client";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { SidebarProvider } from "./sidebar-state";
import { PageTransition } from "@/components/motion/page-transition";

/** Audit tabs share one transition key so the audit layout (and its data) is not remounted between tabs. */
function routeKey(pathname: string) {
  const m = pathname.match(/^\/audits\/([^/]+)/);
  if (m && m[1] !== "new") return `/audits/${m[1]}`;
  return pathname;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <SidebarProvider>
      <div className="flex min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow">
          Skip to content
        </a>
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <PageTransition routeKey={routeKey(pathname)}>{children}</PageTransition>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
