import { bundle } from "./utils.ts";
import { parse } from "https://deno.land/std@0.182.0/flags/mod.ts";

const { indexFileName, envs, minify, externals, mixAllInsideIndex } = parse(
  Deno.args,
);
await bundle(indexFileName, envs, minify, externals, mixAllInsideIndex);
