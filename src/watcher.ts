import {getCurrentFilePath} from "./utils.ts";

const process = Deno.run({
	cmd: ['deno', 'run', '--unstable', '-A', getCurrentFilePath('bundler.ts')],
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
