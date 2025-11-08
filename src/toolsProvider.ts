import { ToolsProviderController } from "@lmstudio/sdk";
import { getReadFileTool } from "./tools/readFile";
import { getWriteFileTool } from "./tools/writeFile";
import { getEditFileTool } from "./tools/editFile";
import { getFindFilesTool } from "./tools/findFiles";
import { getSearchTextTool } from "./tools/searchText";
import { getRemoveFilesTool } from "./tools/removeFiles";
import { getListDirectoryTool } from "./tools/listDirectory";
import { getFetchTool } from "./tools/fetch";
import { getListHistoryTool } from "./tools/listHistory";
import { getGetChangeDetailsTool } from "./tools/getChangeDetails";

export async function toolsProvider(ctl: ToolsProviderController) {
        // All the tools available must be returned here
        return [
                getReadFileTool(ctl),
                getWriteFileTool(ctl),
                getEditFileTool(ctl),
                getFindFilesTool(ctl),
                getSearchTextTool(ctl),
                getRemoveFilesTool(ctl),
                getListDirectoryTool(ctl),
                getFetchTool(ctl),
                getListHistoryTool(ctl),
                getGetChangeDetailsTool(ctl),
        ];
}
