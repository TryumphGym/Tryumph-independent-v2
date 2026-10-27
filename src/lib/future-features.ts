/** Future commercial features. Off until product, privacy and payment reviews are complete. */
export const futureFeatures = {
  tryumphStore: false,
  trainerSourcedMerchandise: false,
  commercialFitnessInsights: false,
} as const;

export type FutureFeature = keyof typeof futureFeatures;

export function isFutureFeatureEnabled(feature: FutureFeature): boolean {
  return futureFeatures[feature];
}
