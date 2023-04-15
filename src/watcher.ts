import {bundle} from "./utils.ts";
import { parse } from "https://deno.land/std@0.182.0/flags/mod.ts";

const { indexFileName } = parse(Deno.args)
bundle(indexFileName)