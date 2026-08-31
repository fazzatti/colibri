import type { ContractBuildRecipe } from "@/core/recipe/types.ts";
import {
  BuildArtifactAmbiguousError,
  BuildArtifactNotFoundError,
} from "@/artifacts/error.ts";
import type { BuildArtifactCandidate } from "@/artifacts/types.ts";

const optionValue = (
  options: readonly string[],
  name: string,
): string | undefined =>
  options.find((option) => option.startsWith(`${name}=`))?.slice(
    name.length + 1,
  );

/** Selects one exact candidate from recipe expectations without path guessing. */
export const selectBuildArtifactCandidate = (
  candidates: readonly BuildArtifactCandidate[],
  recipe: ContractBuildRecipe,
): BuildArtifactCandidate => {
  const packageName = optionValue(recipe.options, "--package")?.replaceAll(
    "-",
    "_",
  );
  const profile = optionValue(recipe.options, "--profile") ?? "release";
  const inProfile = candidates.filter(({ path }) =>
    path.includes(`/${profile}/`)
  );
  const selected = packageName
    ? inProfile.filter(({ path }) => path.endsWith(`/${packageName}.wasm`))
    : inProfile;
  if (selected.length === 0) throw new BuildArtifactNotFoundError();
  if (selected.length > 1) {
    throw new BuildArtifactAmbiguousError(selected.map(({ path }) => path));
  }
  return selected[0];
};
