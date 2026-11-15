/* MILO / ChatGPT — public connector address only; no API keys or credentials.
 * After the operator deploys the independent MCP+OAuth server, set the HTTPS URL.
 * Example: mcpUrl: 'https://mcp.example.com/mcp'
 * Leave empty until the remote MCP server has actually been deployed and tested.
 * This address is SHARED by merchants; OAuth identifies each merchant separately.
 */
window.MILO_CHATGPT_CONFIG = Object.freeze({
  mcpUrl: '',
  pluginsUrl: 'https://chatgpt.com/plugins'
});
