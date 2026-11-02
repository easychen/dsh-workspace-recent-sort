# Publishing to npm

Maintainer checklist for `dsh-workspace-recent-sort`.

## Package facts

| Field | Value |
|---|---|
| Package | `dsh-workspace-recent-sort` |
| Version | `0.2.1` |
| Published | 2026-11-02 (npm `latest`) |
| Registry | <https://registry.npmjs.org/> |
| Access | public (unscoped package) |
| Tarball contents | `lib/index.js`, `lib/client.js`, `cordis.patch.yml`, `README.md`, `LICENSE`, `package.json` |

`package.json` sets `publishConfig.access = "public"` and a
`prepublishOnly` test hook, so `npm publish` runs the unit tests first.

## 1. Log in

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami
```

If the account uses two-factor authentication, keep the authenticator ready and
pass a one-time code on publish with `--otp=123456`.

The npm CLI's active registry must be npmjs. Check it:

```sh
npm config get registry
```

If a mirror such as `https://registry.npmmirror.com/` is configured, publish
with an explicit registry:

```sh
npm publish --registry=https://registry.npmjs.org/ --access public
```

## 2. Preflight

```sh
npm test
npm pack --dry-run
```

The pack listing must contain only the six runtime files above. The `test/`
directory, `PUBLISHING.md`, and `.gitignore` stay out of the tarball.

Optional, but recommended: run the real publish path without publishing.

```sh
npm publish --dry-run --access public
```

The name is registered now:

```sh
npm view dsh-workspace-recent-sort version
# 0.2.1
npm view dsh-workspace-recent-sort@0.2.1 gitHead
# 1da287ecb9db72baecfdbe9672f0fe0932da0b9b
```

A 404 here means the registry or package name is wrong.

## 3. Publish

From the repository root:

```sh
npm publish --access public
```

With 2FA:

```sh
npm publish --access public --otp=123456
```

To publish an already-built tarball instead:

```sh
npm pack --pack-destination /tmp/npm-publish
npm publish /tmp/npm-publish/dsh-workspace-recent-sort-0.2.1.tgz --access public
```

A package version is immutable once published. Fix a mistake by bumping the
patch version and publishing again, not by republishing the same version.

## 4. Verify

```sh
npm view dsh-workspace-recent-sort version
npm view dsh-workspace-recent-sort dist.tarball
```

Then install it into a throwaway DSH Web profile:

```sh
dsh plugin --profile web add dsh-workspace-recent-sort
```

Or verify the tarball contents locally:

```sh
mkdir -p /tmp/dsh-npm-check
cd /tmp/dsh-npm-check
npm init -y
npm install dsh-workspace-recent-sort
find node_modules/dsh-workspace-recent-sort -maxdepth 2 -type f
```

## 5. Registry cleanup (optional)

The first publish also left a staging artifact:

```sh
npm view dsh-workspace-recent-sort versions
# [ '0.0.0-stage', '0.2.1' ]
```

It is not `latest`, so normal installs never see it. Deprecate it, or unpublish
it within npm's 72-hour window and while nothing depends on it:

```sh
npm deprecate dsh-workspace-recent-sort@0.0.0-stage "Staging artifact; use 0.2.1 or later."

# Destructive; only if the staging artifact should disappear entirely:
npm unpublish dsh-workspace-recent-sort@0.0.0-stage
```

## 6. Versioning and Git tags

`package.json` currently reports `0.2.1`, matching the existing GitHub tag
`v0.2.1`. If the npm release includes only README/package metadata changes
after that tag, the runtime code is identical; if exact tag parity is required,
bump the patch version first.

For a new release:

```sh
npm version patch -m "chore: release %s"
git push --follow-tags
gh release create "v$(node -p "require('./package.json').version")" --generate-notes
```

Check that `package.json`'s version, the Git tag, and the GitHub release all
match before publishing.

## Troubleshooting

| Error | Meaning | Action |
|---|---|---|
| `E401` | Not logged in | `npm login`, then `npm whoami` |
| `E403` | Name/permission/2FA | Check the name, account access, and `--otp` |
| `E404` on publish | Wrong registry or missing package permission | Publish with `--registry=https://registry.npmjs.org/` |
| `EOTP` | One-time password required | Re-run with `--otp=123456` |
| `EPUBLISHCONFLICT` | Version already exists | Bump the version and publish again |

Do not commit npm tokens, `.npmrc` files containing `_authToken`, or the
generated `.tgz`.
