/**
 * MCP Tool definitions
 * 
 * These tools are exposed via the MCP protocol to clients like Cursor/Claude
 */

import { CodeGraphEngine } from '@codegraph-cloud/core';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'codegraph_explore',
    description: 'Explore the code graph to find symbols, their relationships, and context. This is the primary tool for understanding code structure.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query or symbol name to explore',
        },
        depth: {
          type: 'number',
          description: 'Depth of graph traversal (default: 2)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'codegraph_search',
    description: 'Search for symbols by name using full-text search',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (supports partial matches)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'codegraph_callers',
    description: 'Find all functions/methods that call a given symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description: 'Name of the symbol to find callers for',
        },
        filePath: {
          type: 'string',
          description: 'Optional file path to narrow results',
        },
      },
      required: ['symbolName'],
    },
  },
  {
    name: 'codegraph_callees',
    description: 'Find all functions/methods called by a given symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description: 'Name of the symbol to find callees for',
        },
        filePath: {
          type: 'string',
          description: 'Optional file path to narrow results',
        },
      },
      required: ['symbolName'],
    },
  },
  {
    name: 'codegraph_impact',
    description: 'Analyze the impact radius of a symbol - what would be affected if it changes',
    inputSchema: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description: 'Name of the symbol to analyze',
        },
        depth: {
          type: 'number',
          description: 'Depth of impact analysis (default: 3)',
        },
      },
      required: ['symbolName'],
    },
  },
  {
    name: 'codegraph_status',
    description: 'Get the current indexing status of the project',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Execute a tool and return the result
 */
export async function executeTool(
  engine: CodeGraphEngine,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  switch (toolName) {
    case 'codegraph_explore':
      return engine.explore(args.query, { depth: args.depth });

    case 'codegraph_search':
      return engine.search(args.query, { limit: args.limit });

    case 'codegraph_callers':
      return engine.getCallers(args.symbolName);

    case 'codegraph_callees':
      return engine.getCallees(args.symbolName);

    case 'codegraph_impact':
      return engine.getImpactRadius(args.symbolName, args.depth || 3);

    case 'codegraph_status':
      return engine.getStatus();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
