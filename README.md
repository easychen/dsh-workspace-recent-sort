# dsh-workspace-recent-sort

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./package.json)

Repository: <https://github.com/easychen/dsh-workspace-recent-sort>

DeepSeek Harness sidebar plugin with three related behaviors:

1. **WorkSpace groups follow “Last updated”** — a Workspace with a newer
   conversation rises to the top of the sidebar.
2. **Compact Workspace conversations** — an expanded Workspace shows only its
   newest conversation; hovering reveals the next few with an animation.
3. **Scroll back after a reorder** — when the automatic ordering moves groups,
   the sidebar scrolls the currently selected conversation back into view.

The ordering and compact-display behaviors have switches in
**Settings → 工作区 / Workspaces**.

## The problem

DSH's native **Order by → Last updated** sorts Sessions *inside* each
Workspace. Workspace groups themselves always render in the Host's durable
`workspaceIds` order (the order produced by dragging folders). A Workspace with
a brand-new conversation therefore stays wherever it was manually placed.

This plugin leaves that durable order untouched. It only changes the browser
projection while, and only while, both of these are selected:

- **Group by** = **WorkSpace** (按工作区)
- **Order by** = **Last updated** (最近更新)

## Behavior

### Recent ordering

- Workspace groups are ordered by the newest `updatedAt` among their real
  conversations, newest first. Archived conversations still count; a visible
  archived row is a real conversation.
- Provisional blank Sessions (the "New Session" placeholder) and hidden
  subagent children do not count as conversation activity.
- Workspaces with no loaded conversation fall to the bottom. Ties keep the
  Host's relative order, so the result is deterministic.
- Switching to **Manual** order (手动排序), **Workspace Tree** (按工作区树), or
  the flat list restores the native order immediately.
- No Host state is written: the durable Workspace order is unchanged, no
  Session is moved, and there is no network request. Workspace drag commits are
  suppressed while **Last updated** is active, because a durable reorder would
  be invisible under the recency projection; switch to **Manual** to arrange
  folders.
- The plugin only wraps the sidebar's registered `WorkspaceBrowser`. The
  Workspace picker, search results, session rows, archive filters, pins, and
  session drag behavior remain native.

### Compact conversations

- In **Group by → WorkSpace**, an expanded Workspace shows only its newest
  conversation row by default.
- Hovering the Workspace header or its visible row animates the next three
  conversations into view (the newest conversation plus three more; a
  provisional New Session row stays visible when present). Moving away collapses
  them again.
- The currently selected conversation stays visible even when it is not the
  newest one, and the **展开其余 xx 个会话 / Show remaining … conversations**
  button stays hidden until the Workspace is hovered or keyboard-focused.
- Keyboard focus inside a Workspace expands all of its rendered rows. Clicking
  **展开其余 xx 个会话 / Show remaining … conversations** raises the native
  watermark for that Workspace; once more than six rows are rendered, hovering
  reveals all of them.
- Collapsed Workspaces, Workspace Tree mode, and the flat list keep their
  native behavior.

### Scroll to the selected conversation

After any Workspace reorder changes the group order — the automatic recent
ordering, a sort-mode switch, or a manual workspace drag — the plugin scrolls
the sidebar so the currently selected conversation is visible. If the row is
already visible, `block: "nearest"` leaves the scroll position alone.

## Settings

**Settings → 工作区 / Workspaces** provides two switches:

| Switch | Default | Effect |
|---|---|---|
| 按最近更新排序工作区 | On | Enable the recent-ordering projection. |
| 工作区对话简约显示 | On | Enable the one-row compact display and hover reveal. |

Settings are browser-local (`dsh.workspace-recent-sort.settings.v1` in
`localStorage`), so different browsers can use different preferences. Toggles
apply immediately without a reload.

## Install

Install the bundle from GitHub into the Web profile:

```sh
dsh plugin --profile web add github:easychen/dsh-workspace-recent-sort
```

The package declares `dsh.bundle.patch`, so it installs as an active profile
bundle. Restart `dsh web` if requested and refresh the Web page.

For local development, link the checkout instead:

```sh
cd ~/.dsh/profiles/web
pnpm add link:/absolute/path/to/dsh-workspace-recent-sort
```

Then make sure `dsh-workspace-recent-sort` is present in
`dsh.profile.bundles` in the profile's `package.json`.

To remove it:

```sh
dsh plugin --profile web remove dsh-workspace-recent-sort
```

The Plugins page / bundle installer offers the same install and removal
operations.

## Compatibility

Built against DSH `0.2.1-rc.2`. The native View-options menu has no public
extension slot for group ordering, so the plugin uses the sidebar
registration's own component seam: it replaces `entry.component` with a wrapper
that preserves the entry's store, injected services, locale, and child-slot
authorization. Compact mode is CSS scoped under a data attribute and targets
structural `data-row-key` attributes rather than hashed class names. If the
sidebar shape is not recognized, the plugin leaves the native component
untouched rather than failing application boot.

## Development

```sh
node --test test/sort.test.mjs
npm pack --dry-run
```

The browser bundle is hand-written against the DSH module loader, so no build
step is required.
