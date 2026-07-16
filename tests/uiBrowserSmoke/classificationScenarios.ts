import assert from "node:assert/strict";
import type { BrowserSmokeContext } from "./scenarioTypes.ts";
import { evaluate, jsonString, waitForExpression } from "./browserHarness.ts";

export async function runClassificationScenarios(context: BrowserSmokeContext) {
  const { client, sessionId, runTest } = context;

  await runTest("classification cold start preserves unknown upgrade settings", async () => {
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const storageKey = "__time_tracker_smoke_settings";
          const unknownKey = "__deleted_category::future-category";
          const settings = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
          settings[unknownKey] = "legacy-marker";
          localStorage.setItem(storageKey, JSON.stringify(settings));
          location.reload();
          return true;
        })()
      `),
      true,
    );
    await waitForExpression(
      client!,
      sessionId,
      `Boolean(document.querySelector('[aria-label=' + ${jsonString(JSON.stringify("分类"))} + ']'))`,
    );
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const storageKey = "__time_tracker_smoke_settings";
          const unknownKey = "__deleted_category::future-category";
          const settings = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
          const mutations = globalThis.__TIME_TRACKER_CLASSIFICATION_MUTATIONS ?? [];
          return settings[unknownKey] === "legacy-marker"
            && !mutations.some((mutation) => mutation.key === unknownKey && mutation.value === null);
        })()
      `),
      true,
    );
  });

  await runTest("app mapping only offers explicit manual categories", async () => {
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const node = document.querySelector('[aria-label=' + ${jsonString(JSON.stringify("分类"))} + ']');
          if (!node) return false;
          node.click();
          return true;
        })()
      `),
      true,
    );
    await waitForExpression(client!, sessionId, `Boolean(document.querySelector(".qp-select-trigger"))`);
    assert.equal(
      await evaluate(client!, sessionId, `
        !document.body.innerText.includes("自动识别")
          && !document.body.innerText.includes("恢复默认识别")
      `),
      true,
    );
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const trigger = document.querySelector('.qp-color-trigger');
          if (!trigger) return false;
          trigger.click();
          return true;
        })()
      `),
      true,
      "missing color field trigger",
    );
    await waitForExpression(client!, sessionId, "Boolean(document.querySelector('.qp-color-popover'))");
    assert.deepEqual(
      await evaluate(client!, sessionId, `
        (() => {
          const tabs = Array.from(document.querySelectorAll('.qp-color-format-segment'));
          const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
          return {
            tabCount: tabs.filter((tab) => tab.getAttribute('role') === 'tab').length,
            selectedLabel: selected?.textContent?.trim() ?? null,
            selectedTabStopCount: tabs.filter((tab) => tab.tabIndex === 0).length,
            panelLabelledBy: document.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby') ?? null,
          };
        })()
      `),
      {
        tabCount: 3,
        selectedLabel: "HEX",
        selectedTabStopCount: 1,
        panelLabelledBy: await evaluate(client!, sessionId, `document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? null`),
      },
    );
    await evaluate(client!, sessionId, `
      (() => {
        const selected = document.querySelector('[role="tab"][aria-selected="true"]');
        selected?.focus();
        selected?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      })()
    `);
    await waitForExpression(client!, sessionId, `document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'RGB'`);
    assert.equal(
      await evaluate(client!, sessionId, `Boolean(document.querySelector('input[aria-label="红色通道"]'))`),
      true,
    );
    await evaluate(client!, sessionId, `
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    `);
    await waitForExpression(client!, sessionId, `!document.querySelector('.qp-color-popover')`);
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const trigger = document.querySelector(".qp-select-trigger");
          if (!trigger) return false;
          trigger.click();
          return true;
        })()
      `),
      true,
    );
    await waitForExpression(client!, sessionId, `Boolean(document.querySelector(".qp-select-menu"))`);
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const labels = Array.from(document.querySelectorAll(".qp-select-option"))
            .map((node) => node.textContent?.trim());
          return labels.at(-1) === "未分类" && !labels.includes("自动识别");
        })()
      `),
      true,
    );
    await evaluate(client!, sessionId, `
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    `);
    await waitForExpression(client!, sessionId, `!document.querySelector(".qp-select-menu")`);
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const trigger = document.querySelector('.qp-select-trigger');
          if (!trigger) return false;
          trigger.focus();
          trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
          return true;
        })()
      `),
      true,
    );
    await waitForExpression(client!, sessionId, `document.activeElement?.classList.contains('qp-select-menu')`);
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const listbox = document.querySelector('.qp-select-menu[role="listbox"]');
          const activeId = listbox?.getAttribute('aria-activedescendant');
          return Boolean(activeId && document.getElementById(activeId)?.getAttribute('role') === 'option');
        })()
      `),
      true,
    );
    await evaluate(client!, sessionId, `
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    `);
    await waitForExpression(client!, sessionId, `!document.querySelector('.qp-select-menu')`);
    await waitForExpression(
      client!,
      sessionId,
      `document.activeElement?.classList.contains('qp-select-trigger')`,
      undefined,
      "select trigger focus restoration",
    );
    assert.equal(
      await evaluate(client!, sessionId, `
        (() => {
          const node = document.querySelector('[aria-label=' + ${jsonString(JSON.stringify("今天"))} + ']');
          if (!node) return false;
          node.click();
          return true;
        })()
      `),
      true,
    );
  });
}
