const MIN_THRESHOLD = 50;
const MAX_RETRIES = 3;
const STALE_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60_000;
const DEFAULT_ESTIMATED_COST = 10;

interface ThrottleStatus {
  currentlyAvailable: number;
  maximumAvailable: number;
  restoreRate: number;
}

interface GraphQLResponse {
  data?: unknown;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  extensions?: {
    cost?: {
      throttleStatus?: ThrottleStatus;
    };
  };
}

export class ThrottleError extends Error {
  readonly shop: string;
  readonly retries: number;
  readonly lastAvailable: number;

  constructor(shop: string, retries: number, lastAvailable: number) {
    super(`Shopify API throttled after ${retries} retries for shop ${shop}`);
    this.name = "ThrottleError";
    this.shop = shop;
    this.retries = retries;
    this.lastAvailable = lastAvailable;
  }
}

class ThrottleBucket {
  private available = 1000;
  private restoreRate = 50;
  private maxBucket = 1000;
  private updatedAt = Date.now();

  getAvailable(): number {
    const elapsed = (Date.now() - this.updatedAt) / 1000;
    return Math.min(
      this.maxBucket,
      this.available + elapsed * this.restoreRate
    );
  }

  consume(cost: number): void {
    this.available = this.getAvailable() - cost;
    this.updatedAt = Date.now();
  }

  sync(status: ThrottleStatus): void {
    this.available = status.currentlyAvailable;
    this.maxBucket = status.maximumAvailable;
    this.restoreRate = status.restoreRate;
    this.updatedAt = Date.now();
  }

  async waitForBudget(minPoints: number): Promise<void> {
    const available = this.getAvailable();
    if (available >= minPoints) {
      return;
    }
    const deficit = minPoints - available;
    const waitMs = Math.ceil((deficit / this.restoreRate) * 1000);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }

  isStale(thresholdMs: number): boolean {
    return Date.now() - this.updatedAt > thresholdMs;
  }
}

const buckets = new Map<string, ThrottleBucket>();
let lastCleanup = 0;

const cleanStaleEntries = (): void => {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.isStale(STALE_MS)) {
      buckets.delete(key);
    }
  }
};

const getBucket = (shop: string): ThrottleBucket => {
  cleanStaleEntries();
  let bucket = buckets.get(shop);
  if (!bucket) {
    bucket = new ThrottleBucket();
    buckets.set(shop, bucket);
  }
  return bucket;
};

const isThrottled = (json: GraphQLResponse): boolean =>
  json.errors?.some((e) => e.extensions?.code === "THROTTLED") ?? false;

const getThrottleStatus = (json: GraphQLResponse): ThrottleStatus | undefined =>
  json.extensions?.cost?.throttleStatus;

interface ShopifyClient {
  graphql(query: string, options?: Record<string, unknown>): Promise<Response>;
}

export const createShopifyClient = (
  admin: {
    graphql(
      query: string,
      options?: Record<string, unknown>
    ): Promise<Response>;
  },
  shop: string
): ShopifyClient => ({
  async graphql(
    query: string,
    options?: Record<string, unknown>
  ): Promise<Response> {
    const bucket = getBucket(shop);

    if (bucket.getAvailable() < MIN_THRESHOLD) {
      await bucket.waitForBudget(MIN_THRESHOLD);
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      bucket.consume(DEFAULT_ESTIMATED_COST);
      const response = await admin.graphql(query, options);
      const cloned = response.clone();

      let json: GraphQLResponse;
      try {
        json = (await cloned.json()) as GraphQLResponse;
      } catch {
        return response;
      }

      const status = getThrottleStatus(json);
      if (status) {
        bucket.sync(status);
      }

      if (!isThrottled(json)) {
        return response;
      }

      if (attempt === MAX_RETRIES) {
        throw new ThrottleError(shop, MAX_RETRIES, bucket.getAvailable());
      }

      const backoffMs = 1000 * 2 ** attempt;
      await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
      await bucket.waitForBudget(MIN_THRESHOLD);
    }

    throw new ThrottleError(shop, MAX_RETRIES, bucket.getAvailable());
  },
});
