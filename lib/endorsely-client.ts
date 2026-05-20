/**
 * Clientside utility mapping Paddle price IDs to the official plans and prices
 * to avoid importing database-tied server modules in client components.
 */
export function getClientPlanDetails(priceId: string): {
  plan: 'starter' | 'growth' | 'scale';
  billingCycle: 'monthly' | 'annual';
  amount: number;
} {
  const priceStarterMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY || 'pri_01kry9prvj4ckwwqzh6y6x18td';
  const priceStarterAnnual = process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL || 'pri_01kry9prvj4ckwwqzh6y6x18td_annual';
  const priceGrowthMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY || 'pri_01kry9xm1m9k635gk2ebebk0d4';
  const priceGrowthAnnual = process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL || 'pri_01kry9xm1m9k635gk2ebebk0d4_annual';
  const priceScaleMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_MONTHLY || 'pri_01krya2rd80y5ry5hvkh7d2dw7';
  const priceScaleAnnual = process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_ANNUAL || 'pri_01krya2rd80y5ry5hvkh7d2dw7_annual';

  const lowerPriceId = (priceId || '').toLowerCase();

  if (priceId === priceStarterMonthly) {
    return { plan: 'starter', billingCycle: 'monthly', amount: 49 };
  } else if (priceId === priceStarterAnnual) {
    return { plan: 'starter', billingCycle: 'annual', amount: 468 };
  } else if (priceId === priceGrowthMonthly) {
    return { plan: 'growth', billingCycle: 'monthly', amount: 99 };
  } else if (priceId === priceGrowthAnnual) {
    return { plan: 'growth', billingCycle: 'annual', amount: 948 };
  } else if (priceId === priceScaleMonthly) {
    return { plan: 'scale', billingCycle: 'monthly', amount: 199 };
  } else if (priceId === priceScaleAnnual) {
    return { plan: 'scale', billingCycle: 'annual', amount: 1908 };
  }

  // Fallbacks based on naming patterns
  const isAnnual = lowerPriceId.includes('annual') || lowerPriceId.includes('yearly') || lowerPriceId.includes('ann');

  if (lowerPriceId.includes('starter')) {
    return { plan: 'starter', billingCycle: isAnnual ? 'annual' : 'monthly', amount: isAnnual ? 468 : 49 };
  } else if (lowerPriceId.includes('growth') || lowerPriceId.includes('pro')) {
    return { plan: 'growth', billingCycle: isAnnual ? 'annual' : 'monthly', amount: isAnnual ? 948 : 99 };
  } else if (lowerPriceId.includes('scale') || lowerPriceId.includes('enterprise')) {
    return { plan: 'scale', billingCycle: isAnnual ? 'annual' : 'monthly', amount: isAnnual ? 1908 : 199 };
  }

  return { plan: 'starter', billingCycle: 'monthly', amount: 49 };
}
