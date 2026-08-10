import type { ProviderToolDefinition } from "@/features/agent/provider";
import { businessToolDefinitions } from "@/features/agent/tools/business-tools";
import { memoryToolDefinitions } from "@/features/agent/tools/memory-tools";
import { mapToolDefinitions } from "@/features/agent/tools/maps-tools";
import { knowledgeToolDefinitions } from "@/features/agent/tools/knowledge-tools";
import type { ToolName } from "@/features/agent/tools/schemas";
import type { ErasedToolDefinition } from "@/features/agent/tools/types";
import { AppError } from "@/lib/errors";

export class ToolRegistry {
  private readonly definitions = new Map<ToolName, ErasedToolDefinition>();

  constructor(definitions: readonly ErasedToolDefinition[]) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.name)) {
        throw new AppError({
          code: "TOOL_REGISTRY_DUPLICATE",
          message: "工具注册表包含重复名称",
        });
      }
      this.definitions.set(definition.name, definition);
    }
  }

  get(name: ToolName): ErasedToolDefinition {
    const definition = this.definitions.get(name);
    if (!definition) {
      throw new AppError({
        code: "TOOL_NOT_FOUND",
        message: "请求的工具不存在",
      });
    }
    return definition;
  }

  find(name: string): ErasedToolDefinition | null {
    return this.definitions.get(name as ToolName) ?? null;
  }

  providerDefinitions(): readonly ProviderToolDefinition[] {
    return [...this.definitions.values()].map(
      ({ name, description, parameters, strict }) => ({
        name,
        description,
        parameters,
        strict,
      }),
    );
  }
}

export function createTaskSixToolRegistry(): ToolRegistry {
  return new ToolRegistry([
    ...businessToolDefinitions,
    ...memoryToolDefinitions,
    ...mapToolDefinitions,
    ...knowledgeToolDefinitions,
  ]);
}
