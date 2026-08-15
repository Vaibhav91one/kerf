// Inside (app) on purpose: the dialog sits over the real dashboard, blurred,
// instead of over an empty page. `kerf login` opens this bare — no `?code=` —
// and prints a short userCode in the terminal for the person to type into the
// field on the final step. See connect-client.tsx's header comment for why
// the code no longer travels in the URL (H1: a link can't type for you).

import HomePage from '../../page';
import { CliConnectClient } from './connect-client';

export default function CliConnectPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="max-w-xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold">Clerk is not configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY before using browser-based CLI login.
        </p>
      </div>
    );
  }
  return (
    <>
      <HomePage />
      <CliConnectClient />
    </>
  );
}
