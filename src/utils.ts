export const getCurrentFilePathLOCAL = (fileName: string) => Deno.realPathSync(new URL(import.meta.url))
	.replace(/\w*.ts/gm, fileName)

export const getCurrentFilePath = (fileName: string) => new URL(import.meta.url).href
	.replace(/\w*.ts/gm, fileName);


export const copyDirRecursive = async (srcDir: string, destDir: string) => {
	await Deno.mkdir(destDir, {recursive: true});
	
	for await (const dirEntry of Deno.readDir(srcDir)) {
		const srcPath = `${srcDir}/${dirEntry.name}`;
		const destPath = `${destDir}/${dirEntry.name}`;
		
		if (dirEntry.isFile) {
			await Deno.copyFile(srcPath, destPath);
		} else if (dirEntry.isDirectory) {
			await copyDirRecursive(srcPath, destPath);
		} else {
			console.warn(`Skipping unsupported directory entry: ${dirEntry.name}`);
		}
	}
}

export const bundle = async (indexFileName: string, minify: boolean, externals: string[]) => {
	const {stderr} = Deno
	
	const process = Deno.run({
		cmd: [
			'deno',
			'run',
			'-A',
			getCurrentFilePath('bundler.ts'),
			`--indexFileName=${indexFileName}`,
			`--minify=${minify}`,
			externals?.length ? `--externals=${externals.join(',')}` : ''
		],
		stdout: 'piped',
		stderr: 'piped',
	});
	
	const [, , currentStderr] = await Promise.all([
		process.status(),
		process.output(),
		process.stderrOutput(),
	]);
	
	const error = new TextDecoder().decode(currentStderr);
	error ? stderr.write(currentStderr) : console.log(`Done!`);
	
	process.close();
}

export const getCurrentDate = () => {
	const now = new Date();
	
	const hours = now.getHours().toString().padStart(2, '0');
	const minutes = now.getMinutes().toString().padStart(2, '0');
	const seconds = now.getSeconds().toString().padStart(2, '0');
	const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
	
	return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}