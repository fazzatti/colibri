import type {
  VerificationSourceProvider,
  VerificationSourceProviderInput,
} from "@/providers/source/types.ts";
import { ArchiveVerificationSourceProvider } from "@/providers/source/archive.ts";
import { FileVerificationSourceProvider } from "@/providers/source/file.ts";
import { HttpVerificationSourceProvider } from "@/providers/source/http.ts";
import { GitHubVerificationSourceProvider } from "@/providers/source/github.ts";
import type { SourceRetrievalPolicy } from "@/core/policy/types.ts";
import type { ResolvedVerificationSource } from "@/core/types/index.ts";
import type {
  SourceAddressResolver,
  SourceHttpTransport,
} from "@/providers/source/types.ts";

/** Dependencies accepted by the default source-provider router. */
export type DefaultVerificationSourceProviderOptions = {
  readonly sourcePolicy: SourceRetrievalPolicy;
  readonly githubToken?: string;
  readonly urlHeaders?: Readonly<Record<string, string>>;
  readonly transport?: SourceHttpTransport;
  readonly addressResolver?: SourceAddressResolver;
};

/** Default router for raw, local, HTTP, and GitHub source inputs. */
export class DefaultVerificationSourceProvider
  implements VerificationSourceProvider {
  readonly #archive = new ArchiveVerificationSourceProvider();
  readonly #file = new FileVerificationSourceProvider();
  readonly #http: HttpVerificationSourceProvider;
  readonly #github: GitHubVerificationSourceProvider;

  /** Creates the router with one shared source-retrieval policy. */
  constructor(options: DefaultVerificationSourceProviderOptions) {
    this.#http = new HttpVerificationSourceProvider({
      policy: options.sourcePolicy,
      headers: options.urlHeaders,
      transport: options.transport,
      addressResolver: options.addressResolver,
    });
    this.#github = new GitHubVerificationSourceProvider({
      policy: options.sourcePolicy,
      token: options.githubToken,
      transport: options.transport,
      addressResolver: options.addressResolver,
    });
  }

  /** Routes one source without extracting it. */
  resolve(
    input: VerificationSourceProviderInput,
  ): Promise<ResolvedVerificationSource> {
    switch (input.source.type) {
      case "archive":
        return this.#archive.resolve(input);
      case "path":
        return this.#file.resolve(input);
      case "url":
        return this.#http.resolve(input);
      case "githubArchive":
      case "githubReleaseAsset":
        return this.#github.resolve(input);
    }
  }
}
