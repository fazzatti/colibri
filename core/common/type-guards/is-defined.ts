/** Returns `true` when the provided value is neither `null` nor `undefined`. */
export const isDefined = <T>(value: T): value is NonNullable<T> => {
  return value !== undefined && value !== null;
};
