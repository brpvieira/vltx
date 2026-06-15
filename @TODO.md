# Publication TODO

Steps remaining to publish `@brpvieira/vltx` to npm.

## 1. Create an npm account

Register at https://www.npmjs.com/signup and verify your email.

Then log in from the terminal:

```sh
npm login
```

## 2. Enable 2FA on your npm account

Go to npmjs.com → Account Settings → Two-Factor Authentication and enable it.
Required by npm for publishing.

## 3. First publish (manual)

```sh
nvm use
npm publish
```

`prepublishOnly` runs tests and rebuilds automatically before upload.
This is the only manual publish — all future releases go through GitHub Actions.

## 4. Wire up the GitHub Actions release workflow

The release workflow (`.github/workflows/release.yml`) publishes on `v*` tags.
It needs one secret:

1. On npmjs.com → **Access Tokens** → Generate new token → type **Automation**.
2. On GitHub → repo → **Settings → Secrets and variables → Actions** → add:
   - Name: `NPM_TOKEN`
   - Value: the token from step 1.

## 5. Tag and release (all future releases)

```sh
nvm use
npm run release        # bumps version, updates CHANGELOG, commits, tags
git push --follow-tags # pushes tag → triggers GitHub Actions → publishes to npm
```
