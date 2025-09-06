import type Dockerode from "dockerode";
import type { Container } from "dockerode";
import type { LogLevelDesc } from "../../logger/types.ts";

/**
 * Contains a combined report of the resource pruning performed
 * by the similarly named utility method of the `Containers` class.
 * All the properties are optional because the method does a best
 * effort algorithm with the pruning meaning that all failures are
 * ignored in favor of continuing with trying to prune other
 * resources, meaning that all four pruning categories (container, volume, network, image)
 * are attempted regardless of how many of them succeed or fail.
 * Based on the above, it is never known for sure if the response object
 * will contain all, some or none of it's properties at all.
 */
export type PruneDockerResourcesResponse = {
  containers?: Dockerode.PruneContainersInfo;
  images?: Dockerode.PruneImagesInfo;
  networks?: Dockerode.PruneNetworksInfo;
  volumes?: Dockerode.PruneVolumesInfo;
};

export type PruneDockerResourcesRequest = {
  logLevel?: LogLevelDesc;
};

export type PushFileFromFsOptions = {
  /**
   * The dockerode container object to send the files to OR a docker container ID that will be used to look up an
   * existing container (it is expected that it is already running).
   */
  containerOrId: Container | string;
  srcFileName?: string;
  srcFileDir?: string;
  srcFileAsString?: string;
  dstFileName: string;
  dstFileDir: string;
};

export type GetDiagnosticsRequest = {
  logLevel: LogLevelDesc;
  dockerodeOptions?: Dockerode.DockerOptions;
};

export type GetDiagnosticsResponse = {
  readonly images: Dockerode.ImageInfo[];
  readonly containers: Dockerode.ContainerInfo[];
  readonly volumes: {
    Volumes: Dockerode.VolumeInspectInfo[];
    Warnings: string[];
  };
  readonly networks: unknown[];
  readonly info: unknown;
  readonly version: Dockerode.DockerVersion;
};

export type DockerPullProgressDetail = {
  readonly current: number;
  readonly total: number;
};

export type DockerPullProgress = {
  readonly status: "Downloading";
  readonly progressDetail: DockerPullProgressDetail;
  readonly progress: string;
  readonly id: string;
};
