export interface WorkspaceSubscription {
  planTier: 'free_trial' | 'starter' | 'pro' | 'enterprise';
  trialStartedAt?: string;
  trialEndsAt?: string;
  status: 'active' | 'past_due' | 'canceled' | 'trial_expired';
}

/**
 * Evaluates subscription status and remaining trial days.
 */
export function getTrialStatus(subscription: WorkspaceSubscription, asOfDateIso: string = new Date().toISOString().split('T')[0]): {
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
} {
  if (subscription.planTier !== 'free_trial' || !subscription.trialEndsAt) {
    return { isTrial: false, isExpired: false, daysRemaining: 0 };
  }

  const endMs = new Date(subscription.trialEndsAt).getTime();
  const asOfMs = new Date(asOfDateIso).getTime();

  if (asOfMs >= endMs) {
    return { isTrial: true, isExpired: true, daysRemaining: 0 };
  }

  const daysRemaining = Math.ceil((endMs - asOfMs) / (1000 * 60 * 60 * 24));
  return { isTrial: true, isExpired: false, daysRemaining };
}
