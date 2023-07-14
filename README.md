# Deno Web Serve

Template repo with this structure:
https://github.com/pagoru/deno-web-serve-template

### File structure

- /.env
- /dev.ts
- /main.ts
- /public/index.html
- /public/assets/...
- /src/main.tsx

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

#### build.ts

```ts
import { build } from "deno_web_serve";
import { load } from "deno/dotenv/mod.ts";

const env = await load();
Object.keys(env).forEach((key) => Deno.env.set(key, env[key]));

await build({
  indexFileName: "main.ts",
  minify: true,
  mixAllInsideIndex: true,
  envs: ["ENVIRONMENT"],
});
```

#### deno.json

```json
{
  "tasks": {
    "start": "deno run -A ./dev.ts",
    "build": "deno run -A ./build.ts"
  },
  "imports": {
    "deno/": "https://deno.land/std@0.194.0/",
    "deno_web_serve": "https://deno.land/x/deno_web_serve@v2.0.0/mod.ts"
  }
}
```

#### /public/index.html

```html
<html>
    <head>
        ...
        <!-- STYLES_FILE -->
    </head>
    ...
    <!-- SCRIPT_ENVS -->
    <!-- SCRIPT_BUNDLE -->
    <!-- SCRIPT_FOOTER -->
</html>
```
