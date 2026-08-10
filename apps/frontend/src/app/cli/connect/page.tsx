import { CliConnectClient } from './connect-client';

type Props = {
  searchParams: Promise<{ code?: string }>;
};

export default async function CliConnectPage({ searchParams }: Props) {
  const { code = '' } = await searchParams;
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-lg font-semibold">Clerk is not configured</h1>
          <p className="mt-2 text-sm text-muted-foreground">Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY before using browser-based CLI login.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <CliConnectClient code={code} />
    </main>
  );
}
