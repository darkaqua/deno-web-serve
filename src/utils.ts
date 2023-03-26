
export const getCurrentFilePathLOCAL = (fileName: string) => Deno.realPathSync(new URL(import.meta.url))
	.replace(/\w*.ts/gm, fileName)

export const getCurrentFilePath = (fileName: string) => {
	const newFileName = new URL(import.meta.url).href.replace(/\w*.ts/gm, fileName);
	console.log(newFileName);
	return newFileName;
}


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
