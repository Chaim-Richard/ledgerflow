import FirstHourGuide from './FirstHourGuide';

export default function OnboardingView() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-5 text-[var(--text)]">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Start your books</h1>
        <p className="text-sm text-[var(--muted)]">Choose your accounts, then work through your first documents and bank statement. Empty books are not yet ready for reporting.</p>
      </header>
      <FirstHourGuide />
    </div>
  );
}
