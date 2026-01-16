import { generateText, generateObject } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { z } from "zod";

const SuggestionSchema = z.object({
  title: z
    .string()
    .describe(
      "Brief, actionable title for the suggestion (e.g., 'Update statistics to 2024 data')",
    ),
  impact: z
    .enum(["high", "medium", "low"])
    .describe(
      "Impact level: high = critical for SEO/freshness, medium = recommended, low = nice to have",
    ),
  recommendation: z
    .string()
    .describe(
      "Detailed recommendation explaining what to change and why it improves the content",
    ),
});

const AnalyzeResponseSchema = z.object({
  contentScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Overall content quality score from 0-100 based on freshness, novelty, and readability",
    ),
  suggestions: z
    .array(SuggestionSchema)
    .describe(
      "List of actionable suggestions to improve content freshness, novelty, and engagement",
    ),
  sources: z
    .array(z.string())
    .describe("URLs of authoritative sources referenced during analysis"),
});

type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

interface AnalyzeRequest {
  content: string;
}

export default defineEventHandler(async (event): Promise<AnalyzeResponse> => {
  const config = useRuntimeConfig(event);

  const agentSecret = config.agentSecret || process.env.AGENT_SECRET;
  const query = getQuery(event);
  const providedSecret = query["agent-secret"];

  if (!agentSecret) {
    throw createError({
      statusCode: 500,
      message: "AGENT_SECRET not configured",
    });
  }

  if (!providedSecret || providedSecret !== agentSecret) {
    throw createError({
      statusCode: 401,
      message: "Invalid or missing agent secret",
    });
  }

  const apiKey = config.aiGatewayApiKey || process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: "AI_GATEWAY_API_KEY not configured",
    });
  }

  const gateway = createGateway({
    apiKey,
  });

  const body = await readBody<AnalyzeRequest>(event);

  if (!body?.content || typeof body.content !== "string") {
    throw createError({
      statusCode: 400,
      message: "Missing required field: content (string)",
    });
  }

  const content = body.content.trim();
  if (content.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Content cannot be empty",
    });
  }

  try {
    // Phase 1: Research with Perplexity Search tool
    const research = await generateText({
      model: gateway("anthropic/claude-opus-4.5"),
      system: `You are an AI SEO analyst. Your job is to research content freshness and novelty.

When given content to analyze:
1. Use the perplexity_search tool to find recent articles on the same topics
2. Search for competing content to assess how novel/unique this content is
3. Look for authoritative sources that could improve the content
4. Note any outdated information, statistics, or claims that need updating

Be thorough in your research - make multiple searches to cover different aspects of the content.`,
      prompt: `Analyze this content for freshness, novelty, and SEO quality. Search for recent related content and competing articles to assess how up-to-date and unique this content is:

---
${content}
---

Research the key topics, claims, and statistics mentioned. Find recent authoritative sources on these topics.`,
      tools: {
        perplexity_search: gateway.tools.perplexitySearch({
          maxResults: 5,
          searchRecencyFilter: "month",
        }),
      },
      maxSteps: 5,
    });

    // Extract source URLs from tool results if available
    const sourceUrls: string[] = [];
    if (research.steps) {
      for (const step of research.steps) {
        if (step.toolResults) {
          for (const result of step.toolResults) {
            if (result.result && typeof result.result === "object") {
              const resultObj = result.result as Record<string, unknown>;
              if (Array.isArray(resultObj.results)) {
                for (const r of resultObj.results) {
                  if (
                    r &&
                    typeof r === "object" &&
                    "url" in r &&
                    typeof r.url === "string"
                  ) {
                    sourceUrls.push(r.url);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Phase 2: Generate structured analysis using the research
    const { object } = await generateObject({
      model: gateway("anthropic/claude-opus-4.5"),
      schema: AnalyzeResponseSchema,
      system: `You are an AI SEO analyst generating structured recommendations.

Based on research results, provide:
1. A contentScore (0-100) reflecting:
   - Freshness: Is the content up-to-date? Are statistics/claims current?
   - Novelty: Does it offer unique insights vs existing content?
   - Readability: Is it well-structured and engaging?

2. Specific suggestions with:
   - Clear, actionable titles
   - Impact levels (high/medium/low)
   - Detailed recommendations explaining what to change and why

3. Source URLs from the research that support your recommendations`,
      prompt: `Based on this research about the content:

${research.text}

Original content analyzed:
---
${content.slice(0, 2000)}${content.length > 2000 ? "..." : ""}
---

Generate a comprehensive SEO analysis with a content score, actionable suggestions, and source URLs.

Consider:
- Is the content up-to-date compared to recent articles on the topic?
- Does it offer unique value vs competing content?
- Are there outdated statistics or claims that need updating?
- How can readability and engagement be improved?

${sourceUrls.length > 0 ? `\nAvailable source URLs from research:\n${sourceUrls.join("\n")}` : ""}`,
    });

    return object;
  } catch (error) {
    console.error("AI analysis error:", error);

    // Return a graceful error response
    if (error instanceof Error && error.message.includes("API")) {
      throw createError({
        statusCode: 503,
        message: "AI service temporarily unavailable. Please try again.",
      });
    }

    throw createError({
      statusCode: 500,
      message: "Failed to analyze content. Please try again.",
    });
  }
});
