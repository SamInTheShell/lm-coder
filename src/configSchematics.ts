import { createConfigSchematics } from "@lmstudio/sdk";

// https://lmstudio.ai/docs/typescript/plugins/custom-configuration
export const configSchematics = createConfigSchematics()
        .field(
                "projectPath",
                "string",
                {
                        displayName: "Project Path",
                        hint: "The directory which the Coder plugin is confined to.",
                        placeholder: "~/project/path",
                },
                "",
        )
        .build();
