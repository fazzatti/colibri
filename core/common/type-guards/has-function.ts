export const hasFunction = <T>(
  obj: NonNullable<T>,
  key: PropertyKey
): key is keyof T & string => {
  return (
    typeof obj === "object" &&
    key in obj &&
    typeof (obj as Record<PropertyKey, unknown>)[key] === "function"
  );
};
