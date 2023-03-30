import esbuild from 'npm:esbuild';
import { ScssModulesPlugin } from 'npm:esbuild-scss-modules-plugin';
import svgrPlugin from 'npm:esbuild-plugin-svgr'
import {copyDirRecursive} from "./utils.ts";

try {
	const srcDir = './src/assets';
	const destDir = './public/assets';
	await copyDirRecursive(srcDir, destDir);
} catch (err) {
	console.error(err);
}
try {
	await esbuild.build({
		entryPoints: ['./src/main.tsx'],
		bundle: true,
		outfile: './public/bundle.js',
		minify: false,
		plugins: [ScssModulesPlugin({ inject: true }), svgrPlugin()],
	});
} catch (e) {
	console.error(e);
}