import { inngest } from "@/inngest/client";
import { firecrawl } from "@/lib/firecrawl";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const URL_REGEX = /https?:\/\/[^\s]+/g;

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const { prompt } = event.data as { prompt: string };
    const urls = (await step.run("extract-urls", async () => {
      return prompt.match(URL_REGEX) ?? [];
    })) as string[];

    const scrappedContent = await step.run("scrape-urls", async () => {
      const results = await Promise.all(
        urls.map(async (url) => {
          const result = await firecrawl.scrape(url, { formats: ["markdown"] });
          return result.markdown;
        }),
      );
      return results.filter(Boolean).join("\n\n");
    });

    const finalPrompt = scrappedContent
      ? `Context:\n${scrappedContent}\n\nQuestion: ${prompt}`
      : prompt;

    await step.run("generate-text", async () => {
      return await generateText({
        model: google("gemini-3-flash-preview"),
        prompt: finalPrompt,
      });
    });
  },
);
