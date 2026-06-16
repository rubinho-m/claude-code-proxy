import { describe, expect, it } from "bun:test";
import type { AnthropicRequest } from "../../../anthropic/schema.ts";
import { countTokens } from "../count-tokens.ts";
import { translateRequest } from "./request.ts";

describe("translateRequest", () => {
  const baseRequest: AnthropicRequest = {
    model: "kimi-k2",
    messages: [{ role: "user", content: "hello" }],
  };

  it("preserves supported reasoning effort values", () => {
    for (const effort of ["low", "medium", "high"] as const) {
      expect(translateRequest({
        ...baseRequest,
        output_config: { effort },
      }).reasoning_effort).toBe(effort);
    }
  });

  it("maps strong Claude effort values to Kimi high", () => {
    for (const effort of ["max", "xhigh", "ultracode"] as const) {
      expect(translateRequest({
        ...baseRequest,
        output_config: { effort: effort as never },
      }).reasoning_effort).toBe("high");
    }
  });

  it("defaults reasoning effort to medium", () => {
    expect(translateRequest(baseRequest).reasoning_effort).toBe("medium");
  });

  it("rejects unknown Claude effort values", () => {
    expect(() =>
      translateRequest({
        ...baseRequest,
        output_config: { effort: "extreme" as never },
      }),
    ).toThrow(
      'Invalid output_config.effort: "extreme". Must be one of: low, medium, high, max, xhigh, ultracode',
    );
  });

  it("translates unsupported tool result content blocks as text parts", () => {
    const req: AnthropicRequest = {
      model: "kimi-k2",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: [
                { type: "text", text: "visible output" },
                { type: "thinking", thinking: "hidden thought" },
              ],
            },
          ],
        },
      ],
    };

    expect(translateRequest(req).messages).toEqual([
      {
        role: "tool",
        tool_call_id: "toolu_1",
        content: [
          { type: "text", text: "visible output" },
          { type: "text", text: "[unsupported content block omitted: thinking]" },
        ],
      },
    ]);
  });

  it("preserves image tool result content parts", () => {
    const req: AnthropicRequest = {
      model: "kimi-k2",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: [
                { type: "text", text: "caption" },
                {
                  type: "image",
                  source: { type: "base64", media_type: "image/png", data: "abc" },
                },
              ],
            },
          ],
        },
      ],
    };

    expect(translateRequest(req).messages).toEqual([
      {
        role: "tool",
        tool_call_id: "toolu_1",
        content: [
          { type: "text", text: "caption" },
          { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
        ],
      },
    ]);
  });

  it("counts unsupported tool result content blocks without throwing", () => {
    const req: AnthropicRequest = {
      model: "kimi-k2",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_1",
              content: [{ type: "thinking", thinking: "hidden thought" }],
            },
          ],
        },
      ],
    };

    expect(countTokens(req)).toBeGreaterThan(0);
  });
});
