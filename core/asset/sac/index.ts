import { Contract } from "@/contract/index.ts";
import { SEP11Asset } from "../sep11/types.ts";

export class SACClient extends Contract {
  constructor(args: { asset: SEP11Asset }) {
    const {} = args;
    super(args);
  }
}
