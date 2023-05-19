# Deno Web Serve

Template repo with this structure: https://github.com/pagoru/deno-web-serve-template

### File structure
- /.env
- /dev.ts 
- /main.ts
- /public/index.html
- /src/main.tsx
- /src/assets/...

#### .env

```env
ENVIRONMENT=DEVELOPMENT
```

#### dev.ts

```ts
import { config } from '$deno/dotenv/mod.ts';

const env = await config();
Object.keys(env).forEach(key => Deno.env.set(key, env[key]));

await import('./main.ts');
```

#### main.ts

```ts
import { webServe } from 'https://deno.land/x/deno_web_serve/mod.ts';

// First param is the entry file, second param is a bool if you want to minify the bundle.js
await webServe("main.tsx", true);
```

#### /public/index.html

```html
<html>
    <head>
        ...
        <link rel="stylesheet" href="/styles.css">
    </head>
    ...
    <!-- SCRIPT_ENVS -->
    <script type="text/javascript" src="/bundle.js"></script>
    <!-- SCRIPT_FOOTER -->
</html>
```

