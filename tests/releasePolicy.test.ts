import assert from "node:assert/strict";
import {
  fieldValue,
  readVersionPolicyCurrentCodeVersion,
  renderUpdaterNotes,
  syncVersionPolicyCurrentCodeVersion,
  validateVersionPolicyCurrentCodeVersionText,
} from "../scripts/release.ts";

const versionPolicyExcerpt = [
  "## 3. 当前仓库现实",
  "",
  "截至当前仓库状态：",
  "",
  "- 代码版本为 `0.4.2`",
  "- 稳定发布线处于 `0.4.x`",
  "",
].join("\n");

function testSyncsCurrentCodeVersion() {
  const updated = syncVersionPolicyCurrentCodeVersion(versionPolicyExcerpt, "0.4.3");
  assert.equal(readVersionPolicyCurrentCodeVersion(updated), "0.4.3");
  assert.match(updated, /- 代码版本为 `0\.4\.3`/);
  assert.match(updated, /- 稳定发布线处于 `0\.4\.x`/);
}

function testSupportsPrereleaseVersion() {
  const updated = syncVersionPolicyCurrentCodeVersion(versionPolicyExcerpt, "0.5.0-beta.1");
  assert.equal(readVersionPolicyCurrentCodeVersion(updated), "0.5.0-beta.1");
}

function testMissingPolicyVersionIsNull() {
  assert.equal(readVersionPolicyCurrentCodeVersion("## empty"), null);
}

function testStalePolicyVersionFailsValidation() {
  assert.equal(
    validateVersionPolicyCurrentCodeVersionText(versionPolicyExcerpt, "0.4.3"),
    "docs/versioning-and-release-policy.md current code version is 0.4.2, expected 0.4.3",
  );
}

function testUpdaterNotesStaySingleLanguage() {
  const sectionBody = [
    "Release: 修复更新说明。",
    "App note: 修复英文更新说明显示。",
    "App note en: Fixed English release notes.",
  ].join("\n");

  const notes = renderUpdaterNotes({
    appNote: fieldValue(sectionBody, "App note"),
    appNoteEn: fieldValue(sectionBody, "App note en"),
  });

  assert.equal(notes, "Fixed English release notes.");
  assert.equal(notes.includes("zh-CN:"), false);
  assert.equal(notes.includes("en-US:"), false);
}

testSyncsCurrentCodeVersion();
testSupportsPrereleaseVersion();
testMissingPolicyVersionIsNull();
testStalePolicyVersionFailsValidation();
testUpdaterNotesStaySingleLanguage();

console.log("Passed 5 release policy tests");
