# Deno Web Serve

Template repo with this structure:
https://github.com/pagoru/deno-web-serve-template

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
import { load } from "deno/dotenv/mod.ts";

const env = await load();
Object.keys(env).forEach((key) => Deno.env.set(key, env[key]));

await import("./main.ts");
```

#### main.ts

```ts
import { webServe } from "deno_web_serve/mod.ts";

await webServe({
  port: 8080,
  indexFileName: "main.tsx",
  minify: false,
  externals: [],
  envs: ["ENVIRONMENT"],
  mixAllInsideIndex: false,
});
```

#### /public/index.html

```html
<html>
    <head>
        ...
        <!-- STYLESHEET -->
    </head>
    ...
    <!-- SCRIPT_ENVS -->
    <!-- SCRIPT_BUNDLE -->
    <!-- SCRIPT_FOOTER -->
</html>
```
