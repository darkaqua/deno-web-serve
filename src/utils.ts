import esbuild from 'npm:esbuild';
import { ScssModulesPlugin } from 'npm:esbuild-scss-modules-plugin';
import svgrPlugin from 'npm:esbuild-plugin-svgr'

export const getCurrentFilePathLOCAL = (fileName: string) => Deno.realPathSync(new URL(import.meta.url))
	.replace(/\w*.ts/gm, fileName)

export const getCurrentFilePath = (fileName: string) => new URL(import.meta.url).href
	.replace(/\w*.ts/gm, fileName);


export const copyDirRecursive = async (srcDir: string, destDir: string) => {
	await Deno.mkdir(destDir, { recursive: true });
	
	for await (const dirEntry of Deno.readDir(srcDir)) {
		const srcPath = `${srcDir}/${dirEntry.name}`;
		const destPath = `${destDir}/${dirEntry.name}`;
		
		if (dirEntry.isFile) {
			await Deno.copyFile(srcPath, destPath);
		} else if(dirEntry.isDirectory) {
			await copyDirRecursive(srcPath, destPath);
		} else {
			console.warn(`Skipping unsupported directory entry: ${dirEntry.name}`);
		}
	}
}

export const bundle = async () => {
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
}