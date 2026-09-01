const CREDENTIAL_NAME =
  /(?:^|[_-])(?:token|key|auth|authorization|signature|secret|credential|cookie|password|passphrase|session|csrf)(?:$|[_-])/i;

const COMPACT_CREDENTIAL_NAME =
  /^(?:sig|jwt|apiKey|accessToken|authToken|bearerToken|cookie2)$/i;

/** Identifies names whose values can carry authentication material. */
export const isCredentialBearingName = (name: string): boolean =>
  COMPACT_CREDENTIAL_NAME.test(name) || CREDENTIAL_NAME.test(name);

/** Removes userinfo and credential-bearing query values from a valid URL. */
export const redactUrlCredentials = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (isCredentialBearingName(key)) {
        url.searchParams.set(key, "<redacted>");
      }
    }
    const fragment = new URLSearchParams(url.hash.slice(1));
    const credentialFragmentNames = [...fragment.keys()].filter(
      isCredentialBearingName,
    );
    if (credentialFragmentNames.length > 0) {
      for (const key of credentialFragmentNames) {
        fragment.set(key, "<redacted>");
      }
      url.hash = fragment.toString();
    }
    return url.toString();
  } catch {
    return undefined;
  }
};
