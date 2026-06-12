# Deployment — code-editor

Vite SPA, deployed to Cloudflare Pages via direct upload.

```bash
cd editor
export PROJECT=code-playground
export LAMBDA_URL=$(aws lambda get-function-url-config --region ap-south-1 \
  --function-name code-lambda --query FunctionUrl --output text)
```

## 1. One-time setup

```bash
npx wrangler login                                              # browser auth
npx wrangler pages project create $PROJECT --production-branch=main
```

The create command prints the production URL (e.g. `code-playground-e3s.pages.dev`).
Save it:

```bash
export PAGES_URL=https://code-playground-e3s.pages.dev
```

Tighten Lambda CORS to this origin (and localhost for dev):

```bash
aws lambda update-function-url-config --region ap-south-1 --function-name code-lambda \
  --cors '{"AllowOrigins":["'$PAGES_URL'","http://localhost:5173"],"AllowMethods":["POST"],"AllowHeaders":["content-type"],"MaxAge":86400}'
```

## 2. Deploy

```bash
VITE_LAMBDA_URL=$LAMBDA_URL npm run build
npx wrangler pages deploy dist --project-name=$PROJECT --branch=main
```

Smoke test: open `$PAGES_URL`, click **Run Code** with `Developer` in stdin. Expect
`Hello Developer!`.

## 3. Re-deploy

Same as step 2:

```bash
VITE_LAMBDA_URL=$LAMBDA_URL npm run build
npx wrangler pages deploy dist --project-name=$PROJECT --branch=main
```

Roll back via dashboard → Deployments → previous build → **Rollback**.

## Notes

- **No GitHub auto-deploy.** Direct-upload Pages projects don't support
  *Connect to Git*. Every deploy is manual.
- **The Workers + Static Assets UI flow doesn't work for this app** —
  it expects a `wrangler.toml` and uses Worker semantics. Stay on Pages.
