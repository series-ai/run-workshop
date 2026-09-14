import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Typewriter } from "./Typewriter";

describe("Typewriter component", () => {
  it("renders text in static markup with full accessibility sequence", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Typewriter, {
        text: "Still Warm",
        instant: true,
      }),
    );
    expect(html).toContain('class="sr-only">Still Warm</span>');
    expect(html).toContain("Still");
    expect(html).toContain("Warm");
  });

  it("handles instant mode properly without errors", () => {
    const onComplete = vi.fn();
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Typewriter, {
        text: "Testing instant complete",
        instant: true,
        onComplete,
      }),
    );
    expect(html).toContain("Testing");
  });
});
