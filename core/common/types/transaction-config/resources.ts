/** A fixed addition, expressed in the units of the containing resource field. */
export type ResourceAmount<T extends number | string> = {
  /** Amount to add, not the final total. Fees use decimal stroop strings. */
  amount: T;
  percent?: never;
};

/** Additional percentage of a simulated recommendation, rounded upward. */
export type ResourcePercent = {
  amount?: never;
  /** Nonnegative percentage: 10 adds 10%, 0.5 adds 0.5%. */
  percent: number;
};

/** Exactly one fixed addition or percentage of the final simulation value. */
export type ResourceAdjustment<T extends number | string> =
  | ResourceAmount<T>
  | ResourcePercent;

/** Absolute declarations replacing final simulation recommendations. */
export interface ResourceOverrides {
  /** Final instruction budget; must be at least the simulated recommendation. */
  instructions?: number;
  /** Final disk-read byte budget; must cover the simulated recommendation. */
  diskReadBytes?: number;
  /** Final write-byte budget; must cover the simulated recommendation. */
  writeBytes?: number;
  /**
   * Final total resource fee in stroops, including both fee components and
   * excluding inclusion fees. Must cover the simulated resource fee. Changing
   * resource declarations does not automatically reprice this amount.
   */
  resourceFee?: string;
}

/** Additions to final simulation recommendations; each field is applied once. */
export interface ResourcePadding {
  /** Extra instructions, or a percentage of the simulated instruction budget. */
  instructions?: ResourceAdjustment<number>;
  /** Extra disk-read bytes, or a percentage of the simulated disk-read budget. */
  diskReadBytes?: ResourceAdjustment<number>;
  /** Extra write bytes, or a percentage of the simulated write-byte budget. */
  writeBytes?: ResourceAdjustment<number>;
  /**
   * Additional total resource fee in stroops, or a percentage of the simulated
   * total resource fee. Excludes inclusion fees. This does not independently
   * guarantee refundable headroom when other resource declarations increase.
   */
  resourceFee?: ResourceAdjustment<string>;
}

/**
 * Optional Soroban resource policy, resolved after the final simulation and
 * before envelope signing. Omission preserves simulation recommendations.
 *
 * A field cannot appear in both branches. Overrides below recommendations,
 * invalid amounts and XDR overflow fail locally. Resource changes never invoke
 * the fee calculator or fetch network settings implicitly. Manual callers
 * intentionally control each field: CPU/byte changes alone leave resourceFee
 * unchanged, including percentage padding. Callers choose sufficient fees and
 * network-valid budgets, or explicitly use calculateResourcePadding to price
 * resource growth. The existing transaction fee strategy is then applied to
 * the adjusted resource fee: base/inclusion preserve their inclusion bid,
 * while max reserves the remainder of its fixed total for inclusion.
 * Classic transaction pipelines reject this configuration.
 */
export interface TransactionResources {
  /** Replace selected recommendations with absolute final declarations. */
  override?: ResourceOverrides;
  /** Add amounts or percentages to selected simulation recommendations. */
  padding?: ResourcePadding;
}
