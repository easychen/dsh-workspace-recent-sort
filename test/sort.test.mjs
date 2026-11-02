import test from "node:test";
import assert from "node:assert/strict";

/** Load the browser bundle under a minimal module-loader facade. */
let definition;
globalThis.window = {
	__ModuleLoader__: {
		load(candidate) {
			definition = candidate;
		}
	}
};
await import("../lib/client.js");
const plugin = definition.factory(() => ({}));
const { latestConversationAt, sortWorkspaceItems, isWorkspaceBrowser, normalizeSettings } = plugin.__test;

/** Build one Workspace entity with member Session ids. */
function workspace(id, sessionIds) {
	return { workspaceId: id, title: id, sessionIds };
}

/** Build one Session summary; omitted fields mean "not loaded". */
function session(updatedAt, extra = {}) {
	return { updatedAt, blank: false, ...extra };
}

test("orders Workspaces by their newest real conversation", () => {
	const byId = {
		"s-old": session(100),
		"s-new": session(300),
		"s-mid": session(200)
	};
	const items = [workspace("a", ["s-old"]), workspace("b", ["s-new"]), workspace("c", ["s-mid"])];
	assert.deepEqual(
		sortWorkspaceItems(items, byId).map((item) => item.workspaceId),
		["b", "c", "a"]
	);
	assert.deepEqual(items.map((item) => item.workspaceId), ["a", "b", "c"], "input order is not mutated");
});

test("keeps Host order for equal times and pushes empty Workspaces last", () => {
	const byId = {
		"s-1": session(500),
		"s-2": session(500)
	};
	const items = [workspace("empty", []), workspace("second", ["s-2"]), workspace("first", ["s-1"])];
	assert.deepEqual(
		sortWorkspaceItems(items, byId).map((item) => item.workspaceId),
		["second", "first", "empty"]
	);
});

test("ignores provisional blank sessions and subagent children", () => {
	const byId = {
		"s-blank": session(900, { blank: true }),
		"s-child": session(950, { origin: "subagent" }),
		"s-real": session(100)
	};
	const items = [workspace("quiet", ["s-real"]), workspace("noisy", ["s-blank", "s-child"])];
	assert.deepEqual(
		sortWorkspaceItems(items, byId).map((item) => item.workspaceId),
		["quiet", "noisy"]
	);
});

test("uses the newest member when a Workspace has several conversations", () => {
	const byId = {
		"s-a": session(100),
		"s-b": session(700),
		"s-c": session(300)
	};
	const items = [workspace("a", ["s-a", "s-b"]), workspace("b", ["s-c"])];
	assert.equal(latestConversationAt(items[0], byId), 700);
	assert.deepEqual(
		sortWorkspaceItems(items, byId).map((item) => item.workspaceId),
		["a", "b"]
	);
});

test("returns the caller array unchanged when there is nothing to sort", () => {
	const items = [workspace("only", ["s-1"])];
	assert.equal(sortWorkspaceItems(items, {}), items);
});

test("recognizes the shipped browser component and refuses its own wrapper", () => {
	function WorkspaceBrowser() {}
	assert.equal(isWorkspaceBrowser(WorkspaceBrowser), true);
	const wrapper = function WorkspaceBrowserRecentSort() {};
	wrapper.__dshWorkspaceRecentSort = true;
	assert.equal(isWorkspaceBrowser(wrapper), false);
	assert.equal(isWorkspaceBrowser(null), false);
	assert.equal(isWorkspaceBrowser(() => {}), false);
});

test("defaults both feature switches to on", () => {
	assert.deepEqual(normalizeSettings(null), { recentSort: true, compact: true });
	assert.deepEqual(normalizeSettings({}), { recentSort: true, compact: true });
	assert.deepEqual(normalizeSettings({ recentSort: false, compact: false }), {
		recentSort: false,
		compact: false
	});
	assert.deepEqual(normalizeSettings({ recentSort: false, compact: "yes" }), {
		recentSort: false,
		compact: true
	});
});
