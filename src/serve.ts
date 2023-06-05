import { serve } from 'https://deno.land/std@0.181.0/http/server.ts';
import * as path from "https://deno.land/std@0.181.0/path/mod.ts";
import {bundle, getCurrentDate, getCurrentFilePath} from "./utils.ts";
import { open } from 'https://deno.land/x/open/index.ts';

const watchPathProcess = async (indexFileName: string, minify: boolean, externals: string[]) => {
	Deno.run({
		cmd: [
			'deno',
			'run',
			'-A',
			'--watch=src/',
			getCurrentFilePath('watcher.ts'),
			`--indexFileName=${indexFileName}`,
			`--minify=${minify}`,
			externals?.length ? `--externals=${externals.join(',')}` : ''
		],
		stdout: 'piped',
		stderr: 'piped',
	});
}

type Props = {
	port?: number;
	indexFileName?: string;
	minify?: boolean;
	externals?: string[],
	envs?: string[]
}

export const build = (indexFileName: string = 'main.tsx', minify: boolean = false, externals: string[] = []): Promise<void> =>
	bundle(indexFileName, minify, externals)

export const webServe = async (
	{
		port = 8080,
		indexFileName = 'main.tsx',
		minify = true,
		externals = [],
		envs = ['ENVIRONMENT']
	}: Props
) => {
	const currentPublicPath = path.join(await Deno.cwd(), 'public/')
	const isDevelopment = Deno.env.get('ENVIRONMENT')! === 'DEVELOPMENT';
	
	const environmentsJson = JSON.stringify(envs
		.reduce((obj, key) => ({...obj, [key]: Deno.env.get(key)}), {}));

	const developmentHotRefreshUrl = "https://raw.githubusercontent.com/pagoru/deno-web-serve/master/src/development-hot-refresh.js";
	const developmentHotRefreshResponse = await fetch(developmentHotRefreshUrl);
	const developmentHotRefresh = await developmentHotRefreshResponse.text();
	
	const indexFileText = (await Deno.readTextFile(currentPublicPath + 'index.html')).replace(
		/<!-- SCRIPT_ENVS -->/,
		`<script type="text/javascript">\n
		window.__env__ = ${environmentsJson}
	</script>`
	);
	const socketList: (WebSocket | undefined)[] = [];

	const DevelopmentFunctions = (() => {
		if (!isDevelopment) return undefined;

		console.clear();
		console.log('>>> DEVELOPMENT MODE <<<');
		
		const getFileChecksum = async (fileName: string) => {
			const bundleText = await Deno.readTextFile(currentPublicPath + fileName);
			
			const data = new TextEncoder().encode(bundleText);
			const digest = await crypto.subtle.digest('sha-256', data.buffer);
			return new TextDecoder().decode(new Uint8Array(digest));
		}
		
		const sendUpdateToClients = () => {
			const socketClientList = socketList.filter((ws?: WebSocket) => ws && ws?.readyState === ws.OPEN)
			console.log(`[${getCurrentDate()}] Sending changes to clients (${socketClientList.length})`)
			socketClientList.forEach((ws: WebSocket) => ws.send('reload'));
		}

		let lastChecksums = {
			bundle: undefined,
			styles: undefined
		}
		
		setInterval(async () => {
			const targetChecksums = {
				bundle: undefined,
				styles: undefined
			}
			try {
				targetChecksums.bundle = await getFileChecksum('bundle.js')
				targetChecksums.styles = await getFileChecksum('styles.css')
			} catch (e) {
				targetChecksums.bundle = 'Error';
				targetChecksums.styles = 'Error';
				Deno.writeTextFileSync(currentPublicPath + 'bundle.js', 'error');
				Deno.writeTextFileSync(currentPublicPath + 'styles.css', 'error');
			}
			if((lastChecksums.bundle && lastChecksums.bundle !== targetChecksums.bundle)
				|| (lastChecksums.styles && lastChecksums.styles !== targetChecksums.styles))
				sendUpdateToClients()
			
			lastChecksums = targetChecksums;
		}, 20);

		const onRequestWebSocket = (request: Request) => {
			if (request.headers.get('upgrade') === 'websocket') {
				const { socket: ws, response } = Deno.upgradeWebSocket(request);
				socketList.push(ws);
				ws.onmessage = (m) => console.log(m)
				return response;
			}
		};

		const onRequestIndex = (): Response => {
			const indexText = indexFileText.replace(
				/<!-- SCRIPT_FOOTER -->/,
				`<script type="text/javascript">\n${developmentHotRefresh}</script>`
			);
			return new Response(indexText, {
				headers: {
					'content-type': 'text/html',
				},
			});
		};

		return {
			onRequestWebSocket,
			onRequestIndex,
		};
	})();
	
	
	if(isDevelopment) {
		setTimeout(() => {
			if(socketList.length === 0)
				open(`http://localhost:${port}`)
		}, 5000)
		watchPathProcess(indexFileName, minify, externals);
	}
	
	await serve(
		async (request: Request) => {
			const webSocketResponse = DevelopmentFunctions?.onRequestWebSocket(request);
			if (webSocketResponse) return webSocketResponse;

			const url = new URL(request.url);
			const filepath = url.pathname ? decodeURIComponent(url.pathname) : '';

			let file;
			if (filepath !== '/') {
				try {
					file = await Deno.open(currentPublicPath + filepath, { read: true });
				} catch {
					// ignore
				}
			}

			if (!file) {
				if (filepath?.split('/')?.pop()?.includes('.')) {
					return new Response('404 Not Found', { status: 404 });
				}

				const devResponse = DevelopmentFunctions?.onRequestIndex();
				if (devResponse) return devResponse;

				return new Response(indexFileText, {
					headers: {
						'content-type': 'text/html',
					},
				});
			}

			return new Response(file?.readable);
		},
		{ port }
	);
	
}
