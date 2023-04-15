import esbuild from 'npm:esbuild';
import { ScssModulesPlugin } from 'npm:esbuild-scss-modules-plugin';
import svgrPlugin from 'npm:esbuild-plugin-svgr'
import {copyDirRecursive} from "./utils.ts";
import { parse } from "https://deno.land/std@0.182.0/flags/mod.ts";

const { indexFileName } = parse(Deno.args)

try {
	const srcDir = './src/assets';
	const destDir = './public/assets';
	await copyDirRecursive(srcDir, destDir);
} catch (err) {
	console.error(err);
}
try {
	await esbuild.build({
		entryPoints: [`./src/${indexFileName}`],
		bundle: true,
		outfile: './public/bundle.js',
		minify: false,
		plugins: [ScssModulesPlugin({ inject: true }), svgrPlugin()],
	});
} catch (e) {
	console.error(e);
}