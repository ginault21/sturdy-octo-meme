# Shopify AI Toolkit Integration

This project uses the Shopify AI Toolkit to help with Shopify development.

## What's Installed

- **Shopify Dev MCP Server** - Provides AI tools with access to:
  - Shopify API documentation
  - GraphQL schema validation
  - Liquid template validation
  - App Bridge documentation
  - Store management via CLI

## Configuration

### OpenCode

Config location: `.opencode/opencode.json`

The MCP server is already configured. When you restart OpenCode or start a new session, you can use prompts like:

```
Use the shopify-dev-mcp tool to search Shopify docs for App Bridge React
```

### VS Code

Config location: `.mcp.json`

The MCP server is configured for VS Code's AI features. Use in chat:

```
Search Shopify docs for rate limiting
```

## Testing

To verify the toolkit is working, try asking:

1. "Why are my App Bridge custom elements not rendering?"
2. "Show me the correct way to use s-select in shopify-app-react-router"
3. "Validate this GraphQL query for fetching products"

## Resources

- [Shopify AI Toolkit Repo](https://github.com/Shopify/shopify-ai-toolkit)
- [Shopify Dev Docs](https://shopify.dev/docs/apps/build/ai-toolkit)
