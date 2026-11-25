// ROC AUC: chance a random positive is ranked above a random negative (ties count half). Threshold-free.
export function auc(scores: number[], positive: boolean[]): number {
  let wins = 0;
  let pairs = 0;
  scores.forEach((s, i) => {
    if (!positive[i]) return;
    scores.forEach((t, j) => {
      if (positive[j]) return;
      pairs++;
      wins += s > t ? 1 : s === t ? 0.5 : 0;
    });
  });
  return pairs ? wins / pairs : NaN;
}

export function prf(predicted: boolean[], positive: boolean[]) {
  const tp = predicted.filter((p, i) => p && positive[i]).length;
  const fp = predicted.filter((p, i) => p && !positive[i]).length;
  const fn = predicted.filter((p, i) => !p && positive[i]).length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

