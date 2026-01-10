const Resolver = require('@forge/resolver');
const { route, asUser, storage } = require('@forge/api');
const { analyzeEmergentWorkflows } = require('./gcpSimResolver');

const resolver = new Resolver.default ? new Resolver.default() : new Resolver();

/**
 * Saves AI analysis results to Forge Storage for persistence.
 */
resolver.define('saveAnalysis', async (req) => {
  try {
    const { projectKey, analysis, timestamp } = req?.payload || {};
    if (!projectKey || !analysis) return { success: false };

    const storageKey = `analysis_${projectKey}`;
    await storage.set(storageKey, { analysis, timestamp, projectKey });
    console.log('[Backend] Saved analysis to storage:', storageKey);
    return { success: true };
  } catch (error) {
    console.error('[Backend] Error saving analysis:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Loads cached AI analysis results from Forge Storage.
 */
resolver.define('loadAnalysis', async (req) => {
  try {
    const { projectKey } = req?.payload || {};
    if (!projectKey) return null;

    const storageKey = `analysis_${projectKey}`;
    const cached = await storage.get(storageKey);
    console.log('[Backend] Loaded analysis from storage:', storageKey, cached ? 'found' : 'not found');
    return cached || null;
  } catch (error) {
    console.error('[Backend] Error loading analysis:', error);
    return null;
  }
});

/**
 * Fetches and transforms Jira issues for a given project key.
 */
const getProjectTasks = async (projectKey) => {
  if (!projectKey) {
    console.warn('[Backend] getProjectTasks called without projectKey');
    return [];
  }

  const jql = `project = "${projectKey}" AND resolution = Unresolved ORDER BY rank DESC`;
  console.log('[Backend] Executing JQL query for project:', projectKey);

  const response = await asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql,
      fields: ['summary', 'status', 'assignee', 'duedate', 'priority'],
      maxResults: 50,
    }),
  });

  const data = await response.json();

  if (!data || !data.issues) {
    console.error('[Backend] Jira API returned no issues structure');
    return [];
  }

  return data.issues.map((issue) => {
    const fields = issue.fields || {};
    return {
      key: issue.key,
      summary: fields.summary || '',
      assignee: fields.assignee ? {
        displayName: fields.assignee.displayName || '',
        accountId: fields.assignee.accountId || '',
      } : null,
      status: fields.status ? {
        name: fields.status.name || '',
        id: fields.status.id || ''
      } : null,
      duedate: fields.duedate || null,
      priority: fields.priority ? {
        name: fields.priority.name || '',
        id: fields.priority.id || ''
      } : null
    };
  });
};

/**
 * Fetches simulation data for the Jira Time Machine app.
 */
resolver.define('fetchSimulationData', async (req) => {
  try {
    const { projectKey } = req?.payload || {};
    return await getProjectTasks(projectKey);
  } catch (error) {
    console.error('[Backend] Error in fetchSimulationData:', error);
    return [];
  }
});

resolver.define('getText', (req) => {
  console.log(req);
  return 'Hello, world!';
});

resolver.define('fetchProjectMembers', async (req) => {
  try {
    const { projectKey } = req.payload || {};
    if (!projectKey) return [];

    console.log('[Backend] Fetching project members for:', projectKey);
    const response = await asUser().requestJira(
      route`/rest/api/3/user/assignable/search?project=${projectKey}`
    );
    const users = await response.json();

    // Clean and sort user data
    return Array.isArray(users) ? users
      .filter(u => u.accountType === 'atlassian')
      .map(u => ({
        accountId: u.accountId,
        displayName: u.displayName,
        avatarUrl: u.avatarUrls ? u.avatarUrls['24x24'] : null
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)) : [];
  } catch (error) {
    console.error('[Backend] Error fetching project members:', error);
    return [];
  }
});

resolver.define('analyzeEmergentWorkflows', async (req) => {
  try {
    const { projectKey, scenarios } = req?.payload || {};
    // 1. Get Project Data
    const tasks = await getProjectTasks(projectKey);

    // 2. Delegate to GCP (with scenarios)
    return await analyzeEmergentWorkflows(tasks, scenarios);
  } catch (error) {
    console.error('[Backend] Error in analyzeEmergentWorkflows resolver:', error);
    return {
      volatilityScore: 0,
      identifiedRisks: [{ type: 'Resolver Error', description: error.message, severity: 'High' }],
      strategicAdvice: ['Check backend logs for details.']
    };
  }
});

// Verify resolver definitions are set up correctly
const definitions = resolver.getDefinitions();
console.log('[Backend] Resolver definitions registered:', Object.keys(definitions));

exports.handler = definitions;
