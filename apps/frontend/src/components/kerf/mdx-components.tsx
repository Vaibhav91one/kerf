// The component set every content/docs/*.mdx page renders through. Starts
// from Fumadocs' own defaults (tables, code blocks, callouts) rather than
// reimplementing them — /docs is the one surface in this app that
// deliberately opts into a second, framework-provided design system instead
// of Kerf's hand-rolled Panel/SectionLabel primitives (see docs.css for the
// retheme that keeps it visually one product).
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
