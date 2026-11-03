import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL as string | undefined;

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Convex is optional during the staged migration to Supabase.
  // Routes still using Convex must be migrated before they can be used without this variable.
  if (!CONVEX_URL) return <>{children}</>;

  const convex = new ConvexReactClient(CONVEX_URL);
  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
