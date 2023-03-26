const connect = () => {
	function handleMessage(ws, data) {
		if (data === 'reload') {
			window.location.reload();
		}
	}
	console.debug('Connecting to Local development server...');

	try {
		let ws = new WebSocket(`ws://${window.location.host}`);
		ws.onmessage = m => handleMessage(ws, m.data);
		ws.onopen = () => {
			console.debug('Connected to Local development server!');
		};
		ws.onclose = () => {
			setTimeout(() => {
				connect();
			}, 100);
		};
	} catch (err) {}
};

connect();
