
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

export const bundle = async (indexFileName: string) => {
	const process = Deno.run({
		cmd: ['deno', 'run', '--unstable', '-A', getCurrentFilePath('bundler.ts'), `--indexFileName=${indexFileName}`],
		stdout: 'piped',
		stderr: 'piped',
	});
	
	const [, , stderr] = await Promise.all([
		process.status(),
		process.output(),
		process.stderrOutput(),
	]);
	
	const error = new TextDecoder().decode(stderr);
	error ? console.error(error) : console.log(`Done!`);
	
	process.close();
}