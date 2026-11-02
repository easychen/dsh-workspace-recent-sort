window.__ModuleLoader__.load({
	id: "dsh-workspace-recent-sort",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		let UI = {};
		try {
			UI = require("@deepseek-ai/dsh-client-ui-primitives") ?? {};
		} catch {
			/* The primitive kit is optional; the fallback switch keeps the page usable. */
		}

		const NS = "workspace-recent-sort";
		const SETTINGS_KEY = "dsh.workspace-recent-sort.settings.v1";
		const DEFAULT_SETTINGS = Object.freeze({ recentSort: true, compact: true });
		const EMPTY_SESSION_IDS = new Set();
		const STYLE_ID = "dsh-workspace-recent-sort/styles";

		const zh = {
			"settings.nav": "工作区",
			"settings.title": "工作区",
			"settings.description": "控制侧栏中工作区分组的排序与对话显示方式。",
			"settings.recentSort.title": "按最近更新排序工作区",
			"settings.recentSort.description":
				"当“分组方式”为“按工作区”且“排序方式”为“最近更新”时，有新对话的工作区会自动排到最上面。",
			"settings.compact.title": "工作区对话简约显示",
			"settings.compact.description":
				"展开的工作区默认只显示最新一条对话；进行中或等待处理的会话始终保留；鼠标悬停时动画展开下几条。",
			"settings.note":
				"简约显示目前作用于“按工作区”分组；被折叠的工作区不受影响。进行中、等待处理以及当前选中的会话不会被隐藏。点击“展开其余 xx 个会话”可查看全部。"
		};
		const en = {
			"settings.nav": "Workspaces",
			"settings.title": "Workspaces",
			"settings.description":
				"Control how Workspace groups are ordered and how their conversations are shown in the sidebar.",
			"settings.recentSort.title": "Order Workspaces by last update",
			"settings.recentSort.description":
				"When Group by is WorkSpace and Order by is Last updated, the Workspace with the newest conversation rises to the top.",
			"settings.compact.title": "Compact Workspace conversations",
			"settings.compact.description":
				"An expanded Workspace shows only its newest conversation; running or waiting sessions stay visible, and hovering animates the next few into view.",
			"settings.note":
				"Compact mode applies to WorkSpace grouping; collapsed Workspaces are unchanged. Running, waiting, and currently selected sessions are never hidden. Use “Show remaining … conversations” to see all."
		};

		/**
		 * Normalize one persisted settings value. Missing keys default to on so a
		 * fresh install gets both features without a migration step.
		 * @param value - parsed localStorage value.
		 * @returns complete settings object.
		 */
		function normalizeSettings(value) {
			const parsed = value !== null && typeof value === "object" ? value : {};
			return {
				recentSort: parsed.recentSort !== false,
				compact: parsed.compact !== false
			};
		}

		/** Read the browser-local settings; a broken value falls back to defaults. */
		function readSettings() {
			try {
				const raw = localStorage.getItem(SETTINGS_KEY);
				return raw === null ? { ...DEFAULT_SETTINGS } : normalizeSettings(JSON.parse(raw));
			} catch {
				return { ...DEFAULT_SETTINGS };
			}
		}

		let settings = readSettings();
		const settingListeners = new Set();

		/** Stable snapshot for useSyncExternalStore. */
		function getSettings() {
			return settings;
		}

		/** Subscribe to same-tab setting writes. */
		function subscribeSettings(listener) {
			settingListeners.add(listener);
			return () => settingListeners.delete(listener);
		}

		/** Publish one atomic settings snapshot. */
		function publishSettings(next) {
			settings = next;
			try {
				localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
			} catch {
				/* Private browsing can refuse storage; the in-memory value still works. */
			}
			for (const listener of [...settingListeners]) {
				try {
					listener();
				} catch (error) {
					console.warn("[workspace-recent-sort] settings listener failed:", error);
				}
			}
		}

		/** Write one feature switch. */
		function setSetting(key, value) {
			publishSettings({ ...settings, [key]: value === true });
		}

		/* Module-scope selectors keep hook identity stable across renders. */
		const selectGroupBy = (state) => state.groupBy;
		const selectOrderBy = (state) => state.orderBy;
		const selectSessions = (state) => state;
		const selectStatuses = (state) => state;
		const selectWorkspaceItems = (state) => state.items;

		/* A drag cannot authorize a durable reorder the projection would hide. */
		const ignoreWorkspaceReorder = async () => {};

		/** Quote one Session id for a data-row-key selector. */
		function sessionRowSelector(sessionId) {
			const escaped =
				typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(sessionId) : sessionId;
			return `[data-row-key="session:${escaped}"]`;
		}

		/**
		 * Latest real conversation time inside one Workspace.
		 *
		 * Provisional blank Sessions are the "New Session" placeholder, and
		 * subagent children are hidden rows; neither is a conversation the
		 * sidebar shows, so neither decides where the group sits.
		 *
		 * @param workspace - Workspace entity carrying member Session ids.
		 * @param byId - current Session summaries by id.
		 * @returns epoch milliseconds, or -1 when no member has a summary yet.
		 */
		function latestConversationAt(workspace, byId) {
			let latest = -1;
			const sessionIds = workspace === null || workspace === void 0 ? void 0 : workspace.sessionIds;
			if (!Array.isArray(sessionIds) || byId === null || byId === void 0) return latest;
			for (const sessionId of sessionIds) {
				const session = byId[sessionId];
				if (session === void 0 || session.blank === true || session.origin === "subagent") continue;
				const updatedAt = session.updatedAt;
				if (typeof updatedAt === "number" && Number.isFinite(updatedAt) && updatedAt > latest) latest = updatedAt;
			}
			return latest;
		}

		/**
		 * Order Workspace groups newest conversation first.
		 *
		 * Ties and Workspaces with no loaded conversation keep the Host's
		 * relative order, and empty Workspaces fall to the end. The input array
		 * is never mutated.
		 *
		 * @param items - Workspace entities in Host order.
		 * @param byId - current Session summaries by id.
		 * @returns a stable new array in display order.
		 */
		function sortWorkspaceItems(items, byId) {
			if (!Array.isArray(items) || items.length < 2) return items;
			return items
				.map((workspace, index) => ({
					workspace,
					index,
					latest: latestConversationAt(workspace, byId)
				}))
				.sort((left, right) => {
					if (left.latest !== right.latest) return right.latest - left.latest;
					return left.index - right.index;
				})
				.map((row) => row.workspace);
		}

		/**
		 * Session ids whose row must stay visible in compact mode: a running turn,
		 * a running subagent child, or a pending interaction. The native watermark
		 * already keeps these rows rendered; compact mode must not hide them.
		 *
		 * @param sessions - current Session list snapshot.
		 * @param statuses - unified UI status by Session.
		 * @returns ids of active rows, empty when no status is available.
		 */
		function collectActiveSessionIds(sessions, statuses) {
			const ids = new Set();
			const byId = sessions === null || sessions === void 0 ? void 0 : sessions.byId;
			if (byId === null || byId === void 0) return ids;
			const statusOf = (id) =>
				statuses !== null && statuses !== void 0 && typeof statuses.get === "function" ? statuses.get(id) : void 0;
			for (const [id, session] of Object.entries(byId)) {
				if (session === void 0) continue;
				const status = statusOf(id);
				if ((status?.running ?? session.running) === true) ids.add(id);
				if (status?.pendingInteraction !== null && status?.pendingInteraction !== void 0) ids.add(id);
				const children = sessions.projectionsBySession?.[id]?.values?.subagentCatalog;
				if (
					Array.isArray(children) &&
					children.some((child) => (statusOf(child.id)?.running ?? byId[child.id]?.running) === true)
				) {
					ids.add(id);
				}
			}
			return ids;
		}

		/**
		 * Recognize the shipped WorkspaceBrowser registration. The adapter is
		 * deliberately shape-checked: on an unrecognized sidebar it leaves the
		 * native rendering untouched instead of failing application boot.
		 *
		 * @param component - candidate registration component.
		 * @returns whether this is the shipped browser component.
		 */
		function isWorkspaceBrowser(component) {
			if (typeof component !== "function") return false;
			if (component.__dshWorkspaceRecentSort === true) return false;
			if (component.name === "WorkspaceBrowser") return true;
			let source;
			try {
				source = Function.prototype.toString.call(component);
			} catch {
				return false;
			}
			return source.includes("storedWorkspaces") && source.includes("useWorkspaces") && source.includes("useStore");
		}

		/** A native-looking fallback when the primitive kit is unavailable. */
		function FallbackSwitch({ checked, disabled, label, onChange }) {
			return React.createElement("input", {
				type: "checkbox",
				role: "switch",
				checked: checked === true,
				disabled: disabled === true,
				"aria-label": label,
				onChange: (event) => onChange(event.target.checked)
			});
		}

		const Switch = typeof UI.Switch === "function" ? UI.Switch : FallbackSwitch;

		/** One settings preference row. */
		function SettingRow({ title, description, checked, onChange }) {
			return React.createElement(
				"div",
				{ className: "dwrs-row" },
				React.createElement(
					"div",
					{ className: "dwrs-row-body" },
					React.createElement("div", { className: "dwrs-row-title" }, title),
					React.createElement("div", { className: "dwrs-row-description" }, description)
				),
				React.createElement(Switch, { checked, label: title, onChange })
			);
		}

		/**
		 * The plugin's Settings page: one switch per feature. Both switches write
		 * the same browser-local store the sidebar wrapper subscribes to, so a
		 * toggle takes effect without a reload.
		 */
		function WorkspaceSettingsSection({ t }) {
			const tr = typeof t === "function" ? t : (key) => key;
			const value = React.useSyncExternalStore(subscribeSettings, getSettings, getSettings);
			return React.createElement(
				"div",
				{ className: "dwrs-settings" },
				React.createElement("div", { className: "dwrs-title" }, tr("settings.title")),
				React.createElement("div", { className: "dwrs-description" }, tr("settings.description")),
				React.createElement(SettingRow, {
					title: tr("settings.recentSort.title"),
					description: tr("settings.recentSort.description"),
					checked: value.recentSort,
					onChange: (next) => setSetting("recentSort", next)
				}),
				React.createElement(SettingRow, {
					title: tr("settings.compact.title"),
					description: tr("settings.compact.description"),
					checked: value.compact,
					onChange: (next) => setSetting("compact", next)
				}),
				React.createElement("div", { className: "dwrs-note" }, tr("settings.note"))
			);
		}

		const CSS = `
.dwrs-settings{display:flex;flex-direction:column;width:100%;max-width:720px;padding:4px 0 24px}
.dwrs-title{font-size:16px;line-height:24px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0 0 4px}
.dwrs-description{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin:0 0 16px}
.dwrs-row{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:14px 0;border-top:1px solid var(--dsw-alias-border-l2)}
.dwrs-row:last-of-type{border-bottom:1px solid var(--dsw-alias-border-l2)}
.dwrs-row-body{min-width:0;flex:1}
.dwrs-row-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dwrs-row-description{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dwrs-note{margin-top:14px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]) > span:nth-of-type(n+3):has(> [data-row-key^="session:"]){max-height:0;opacity:0;overflow:hidden;transform:translateY(-3px);pointer-events:none;transition:max-height 220ms cubic-bezier(.2,.8,.2,1),opacity 160ms ease,transform 220ms cubic-bezier(.2,.8,.2,1)}
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]):not(:has(> span:nth-of-type(2) > [data-row-key^="session:"] > span:nth-child(3))) > span:nth-of-type(3):has(> [data-row-key^="session:"]){max-height:48px !important;opacity:1 !important;transform:none !important;pointer-events:auto !important;overflow:visible !important}
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]) > button[data-row-key^="overflow:"]{display:block;max-height:0;opacity:0;overflow:hidden;padding-top:0;padding-bottom:0;pointer-events:none;transition:max-height 220ms cubic-bezier(.2,.8,.2,1),opacity 160ms ease}
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]):hover > button[data-row-key^="overflow:"],
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]):has(:focus-visible) > button[data-row-key^="overflow:"]{max-height:28px;opacity:1;pointer-events:auto;overflow:visible}
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]):hover > span:nth-of-type(n+3):nth-of-type(-n+5):has(> [data-row-key^="session:"]),
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]):not(:has(> span:nth-of-type(2) > [data-row-key^="session:"] > span:nth-child(3))):hover > span:nth-of-type(n+4):nth-of-type(-n+6):has(> [data-row-key^="session:"]),
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span:nth-of-type(8)):hover > span:has(> [data-row-key^="session:"]),
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] div:has(> span > [data-row-key^="workspace:"]):has(:focus-visible) > span:has(> [data-row-key^="session:"]),
[data-dsh-workspace-recent-sort][data-dsh-compact="on"] span[data-dsh-compact-keep]{max-height:48px !important;opacity:1 !important;transform:none !important;pointer-events:auto !important;overflow:visible !important}
`;

		/**
		 * Wrap the sidebar browser: while the operator selected
		 * Group by WorkSpace + Order by Last updated, project Workspace items in
		 * latest-conversation order. Every other mode passes the native snapshot
		 * through untouched. While compact mode is on, the same wrapper scopes the
		 * CSS that keeps one conversation visible and animates the rest on hover.
		 *
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			if (ctx === void 0 || ctx.slots === void 0) return;

			const locale = typeof ctx.get === "function" ? ctx.get("locale") : void 0;
			const tr =
				locale !== void 0 && typeof locale.bind === "function"
					? locale.bind(NS)
					: (key) => (typeof document !== "undefined" && document.documentElement.lang.startsWith("zh") ? zh[key] ?? key : en[key] ?? key);

			if (locale !== void 0 && typeof locale.register === "function") {
				ctx.effect(() => locale.register(NS, { zh, en }), "workspace-recent-sort: dictionaries");
			}

			ctx.effect(() => {
				if (typeof document === "undefined") return () => {};
				if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return () => {};
				const tag = document.createElement("style");
				tag.dataset.plugin = "dsh-workspace-recent-sort";
				tag.dataset.pluginCss = STYLE_ID;
				tag.textContent = CSS;
				document.head.appendChild(tag);
				return () => tag.remove();
			}, "workspace-recent-sort: styles");

			ctx.effect(() => {
				if (typeof window === "undefined") return () => {};
				const onStorage = (event) => {
					if (event.key !== SETTINGS_KEY) return;
					try {
						publishSettings(normalizeSettings(event.newValue === null ? null : JSON.parse(event.newValue)));
					} catch {
						/* Another tab wrote an unusable value; keep the current settings. */
					}
				};
				window.addEventListener("storage", onStorage);
				return () => window.removeEventListener("storage", onStorage);
			}, "workspace-recent-sort: settings sync");

			ctx.slots.inject("settings.section", () =>
				ctx.slots.register(
					{
						name: "settings.section",
						id: "workspace-recent-sort",
						order: 30,
						label: () => tr("settings.nav"),
						locale: NS
					},
					WorkspaceSettingsSection
				)
			);

			/** @type {{ entry: object, wrapper: Function, original: Function } | null} */
			let installed = null;

			const restore = () => {
				if (installed === null) return;
				if (installed.entry.component === installed.wrapper) installed.entry.component = installed.original;
				installed = null;
			};

			const install = () => {
				let entry;
				try {
					entry = ctx.slots.entries("sidebar.workspaces").find((candidate) => isWorkspaceBrowser(candidate.component));
				} catch (error) {
					console.warn("[workspace-recent-sort] cannot inspect the sidebar registration:", error);
					return;
				}
				if (entry === void 0) return;
				if (installed !== null && installed.entry === entry && entry.component === installed.wrapper) return;

				restore();
				const Original = entry.component;

				function WorkspaceBrowserRecentSort(props) {
					if (
						typeof props.useStore !== "function" ||
						typeof props.useSessions !== "function" ||
						typeof props.useSessionStatus !== "function" ||
						typeof props.useWorkspaces !== "function"
					) {
						/* Capability is fixed per registration, so hook order stays stable. */
						return Original(props);
					}

					const groupBy = props.useStore(selectGroupBy);
					const orderBy = props.useStore(selectOrderBy);
					const sessions = props.useSessions(selectSessions);
					const statuses = props.useSessionStatus(selectStatuses);
					const rawItems = props.useWorkspaces(selectWorkspaceItems);
					const prefs = React.useSyncExternalStore(subscribeSettings, getSettings, getSettings);
					const active = prefs.recentSort && groupBy === "workspace" && orderBy === "updated";
					const compactActive = prefs.compact && groupBy === "workspace";
					const activeSessionIds = React.useMemo(
						() => (compactActive ? collectActiveSessionIds(sessions, statuses) : EMPTY_SESSION_IDS),
						[compactActive, sessions, statuses]
					);

					const displayItems = React.useMemo(
						() => (active ? sortWorkspaceItems(rawItems, sessions.byId) : rawItems),
						[active, rawItems, sessions.byId]
					);
					const orderSignature = React.useMemo(
						() => displayItems.map((workspace) => workspace.workspaceId).join("|"),
						[displayItems]
					);
					const currentSessionId = React.useMemo(() => {
						for (const session of Object.values(sessions.byId)) {
							if ((session.retainedBy === void 0 ? 0 : session.retainedBy.mainView ?? 0) > 0) return session.id;
						}
						return void 0;
					}, [sessions]);

					/*
					 * Project one derived snapshot per native Workspace snapshot. The
					 * cached object is what keeps useSyncExternalStore from observing a
					 * fresh value on every call.
					 */
					const useWorkspaces = React.useMemo(() => {
						let previousState;
						let projected;
						return (selector) =>
							props.useWorkspaces((state) => {
								if (state !== previousState) {
									previousState = state;
									projected =
										active && state.items === rawItems
											? { ...state, items: displayItems }
											: state;
								}
								return selector(projected);
							});
					}, [active, displayItems, rawItems, props.useWorkspaces]);

					const rootRef = React.useRef(null);
					const lastOrderRef = React.useRef(orderSignature);

					/* Keep the selected row visible even when compact mode hides it. */
					React.useLayoutEffect(() => {
						const root = rootRef.current;
						if (root === null) return;
						const mark = () => {
							const targets = new Set();
							if (compactActive) {
								for (const id of activeSessionIds) {
									const row = root.querySelector(sessionRowSelector(id));
									if (row !== null) targets.add(row.parentElement ?? row);
								}
								if (currentSessionId !== void 0) {
									const row = root.querySelector(sessionRowSelector(currentSessionId));
									if (row !== null) targets.add(row.parentElement ?? row);
								}
								/* Status data is authoritative; the spinner also covers rows whose activity is not in it. */
								for (const row of root.querySelectorAll('[data-row-key^="session:"]')) {
									if (row.querySelector('svg[class*="_spinner"]') !== null) targets.add(row.parentElement ?? row);
								}
							}
							for (const node of root.querySelectorAll("[data-dsh-compact-keep]")) {
								if (!targets.has(node)) node.removeAttribute("data-dsh-compact-keep");
							}
							for (const node of targets) {
								if (!node.hasAttribute("data-dsh-compact-keep")) node.setAttribute("data-dsh-compact-keep", "");
							}
						};
						let frame = 0;
						const schedule = () => {
							if (frame !== 0) return;
							frame = requestAnimationFrame(() => {
								frame = 0;
								mark();
							});
						};
						mark();
						const observer = new MutationObserver(schedule);
						observer.observe(root, { childList: true, subtree: true });
						return () => {
							observer.disconnect();
							if (frame !== 0) cancelAnimationFrame(frame);
						};
					}, [compactActive, currentSessionId, activeSessionIds]);

					/* A reorder moves the selected conversation; bring it back into view. */
					React.useEffect(() => {
						if (lastOrderRef.current === orderSignature) return;
						lastOrderRef.current = orderSignature;
						if (currentSessionId === void 0) return;
						const frame = requestAnimationFrame(() => {
							const root = rootRef.current;
							if (root === null) return;
							const row = root.querySelector(sessionRowSelector(currentSessionId));
							if (row === null) return;
							const reduceMotion =
								typeof window !== "undefined" &&
								typeof window.matchMedia === "function" &&
								window.matchMedia("(prefers-reduced-motion: reduce)").matches;
							row.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
						});
						return () => cancelAnimationFrame(frame);
					}, [orderSignature, currentSessionId]);

					const tree = Original({
						...props,
						useWorkspaces,
						insertWorkspaceBefore: active ? ignoreWorkspaceReorder : props.insertWorkspaceBefore
					});

					return React.createElement(
						"div",
						{
							ref: rootRef,
							"data-dsh-workspace-recent-sort": "",
							"data-dsh-compact": compactActive ? "on" : void 0,
							style: { display: "contents" }
						},
						tree
					);
				}

				WorkspaceBrowserRecentSort.__dshWorkspaceRecentSort = true;
				entry.component = WorkspaceBrowserRecentSort;
				installed = { entry, wrapper: WorkspaceBrowserRecentSort, original: Original };
			};

			ctx.effect(() => {
				install();
				const off = ctx.slots.subscribe("sidebar.workspaces", () => {
					install();
				});
				return () => {
					off();
					restore();
				};
			}, "workspace-recent-sort: wrap the sidebar WorkspaceBrowser");
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale"];
		exports.__test = {
			latestConversationAt,
			sortWorkspaceItems,
			isWorkspaceBrowser,
			normalizeSettings,
			collectActiveSessionIds
		};
		return module.exports;
	}
});
