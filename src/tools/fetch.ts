import { tool, ToolsProviderController } from "@lmstudio/sdk";
import { z } from "zod";

export const getFetchTool = (ctl: ToolsProviderController) => {
        return tool({
                name: "fetch",
                description: "Fetch a URL using GET method.",
                parameters: {
                        url: z.string().describe("The URL to fetch"),
                },
                implementation: async ({ url }, { signal }) => {
                        try {
                                const response = await fetch(url, {
                                        method: "GET",
                                        signal, // Pass the signal to fetch to allow cancellation
                                });

                                if (!response.ok) {
                                        return `Error: Failed to fetch ${url}: ${response.statusText}`;
                                }

                                const data = await response.text();

                                return {
                                        status: response.status,
                                        headers: Object.fromEntries(response.headers.entries()),
                                        data: data.substring(0, 1000), // Limit to 1000 characters
                                };
                        } catch (error: any) {
                                if (error.name === "AbortError") {
                                        return "Error: Fetch request was cancelled.";
                                }
                                return `Error fetching URL: ${error.message}`;
                        }
                },
        });
};
