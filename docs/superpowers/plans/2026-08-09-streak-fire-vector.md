# Streak Fire Vector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one editable, premium streak-fire vector illustration to the existing Kerf Figma Design file.

**Architecture:** Create an isolated Figma page for the asset, then construct the illustration from named vector paths inside a 64 × 64 component. Verify both structure and rendered appearance through Figma metadata and a screenshot.

**Tech Stack:** Figma Design, Figma Plugin API, official Figma MCP tools

---

### Task 1: Create the vector asset

**Files:**
- Create in Figma file `VdPEaCxSvkLqEKibE5qpRE`: page `Assets — Streak Fire`, component `Illustration / Streak Fire`

- [ ] **Step 1: Search the design system**

Search the target file for an existing streak-fire asset or relevant semantic color variables. Reuse a suitable match only if one exists.

- [ ] **Step 2: Create the isolated page and component**

Use `figma.createPage()` only when `Assets — Streak Fire` does not already exist. Create a transparent 64 × 64 component named `Illustration / Streak Fire`.

- [ ] **Step 3: Build editable vector paths**

Create a rounded outer flame, inner flame, and spark as separate named vector nodes. Use warm orange, amber, and pale-gold fills with no text, raster images, or heavy effects.

- [ ] **Step 4: Verify document structure**

Read the new page metadata and confirm the component and its named vector children exist at 64 × 64.

- [ ] **Step 5: Verify the rendering**

Capture the component at high resolution and visually confirm that it reads as a flame, remains balanced in the square, and has clean edges on a transparent background.

- [ ] **Step 6: Record completion**

Update this plan's checkboxes and commit the completed plan document without staging unrelated workspace files.
