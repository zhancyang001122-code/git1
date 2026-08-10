interface MetricAggregate {
  count: number;
  sum: number;
  max: number;
}

export function createMetricsRegistry() {
  const values = new Map<string, MetricAggregate>();
  return {
    observe(name: string, value: number) {
      if (!Number.isFinite(value) || value < 0) return;
      const current = values.get(name) ?? { count: 0, sum: 0, max: 0 };
      values.set(name, {
        count: current.count + 1,
        sum: current.sum + value,
        max: Math.max(current.max, value),
      });
    },
    snapshot() {
      return Object.fromEntries(
        [...values.entries()].map(([name, aggregate]) => [
          name,
          {
            count: aggregate.count,
            average:
              aggregate.count === 0 ? 0 : aggregate.sum / aggregate.count,
            max: aggregate.max,
          },
        ]),
      );
    },
  };
}

export const metrics = createMetricsRegistry();
