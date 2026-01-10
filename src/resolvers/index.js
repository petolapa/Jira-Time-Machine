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
    return { success: true };
  } catch (error) {
    console.error('Error saving analysis:', error.message);
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
    return cached || null;
  } catch (error) {
    console.error('Error loading analysis:', error.message);
    return null;
  }
});

/**
 * Fetches and transforms Jira issues for a given project key.
 */
const getProjectTasks = async (projectKey) => {
  if (!projectKey) {
    return [];
  }

  const jql = `project = "${projectKey}" AND resolution = Unresolved ORDER BY rank DESC`;

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
    console.error('Error in fetchSimulationData:', error.message);
    return [];
  }
});

resolver.define('fetchProjectMembers', async (req) => {
  try {
    const { projectKey } = req.payload || {};
    if (!projectKey) return [];

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
    console.error('Error fetching project members:', error.message);
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
    console.error('Error in analyzeEmergentWorkflows:', error.message);
    return {
      volatilityScore: 0,
      identifiedRisks: [{ type: 'Resolver Error', description: error.message, severity: 'High' }],
      strategicAdvice: ['Check backend logs for details.']
    };
  }
});

const definitions = resolver.getDefinitions();

exports.handler = definitions;
