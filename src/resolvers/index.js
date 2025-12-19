import Resolver from '@forge/resolver';
import { route, asUser } from '@forge/api';

const resolver = new Resolver();

/**
 * Fetches simulation data for the Jira Time Machine app.
 * Uses backend API to avoid 403 permission errors from frontend requests.
 * 
 * @param {Object} req - Request object from Forge resolver
 * @returns {Promise<Array>} Array of task objects with key, summary, assignee, status, duedate, priority
 */
resolver.define('fetchSimulationData', async (req) => {
  try {
    // Simplified JQL: target keys directly (globally unique in Jira)
    // This avoids project matching issues
    const jql = 'key in (KAN-1, KAN-2, KAN-3)';
    
    console.log('[Backend] Executing JQL query:', jql);

    // NEW ENDPOINT: /rest/api/3/search/jql (Strictly compliant with error message)
    // NOTE: The URL below MUST NOT have any '?' or parameters attached.
    const response = await asUser().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql: 'key in (KAN-1, KAN-2, KAN-3)',
        // Note: 'search/jql' endpoint sometimes uses 'fields' differently,
        // but we start with the standard structure.
        fields: ['summary', 'status', 'assignee', 'duedate', 'priority'],
        maxResults: 100,
      }),
    });
    const data = await response.json();
    
    // Debug logging: log the raw JSON response
    console.log('[Backend] Raw Jira API response:', JSON.stringify(data, null, 2));
    console.log('[Backend] Response status:', response.status);
    console.log('[Backend] data.issues exists?', Array.isArray(data.issues));
    console.log('[Backend] data.issues length:', data.issues ? data.issues.length : 'N/A');
    
    // Validation: check if data.issues exists
    if (!data.issues) {
      console.error('[Backend] Jira API returned no issues structure. Response keys:', Object.keys(data));
      throw new Error('Jira API returned no issues structure');
    }
    
    const issues = Array.isArray(data.issues) ? data.issues : [];
    console.log('[Backend] Processing', issues.length, 'issues');
    console.log('Backend: Found issues:', data.issues.length);
    
    // Transform to clean JSON array suitable for frontend
    const tasks = issues.map((issue) => {
      const issueFields = issue.fields || {};
      const assignee = issueFields.assignee;
      
      return {
        key: issue.key,
        summary: issueFields.summary || '',
        assignee: assignee ? {
          displayName: assignee.displayName || '',
          accountId: assignee.accountId || '',
          emailAddress: assignee.emailAddress || ''
        } : null,
        status: issueFields.status ? {
          name: issueFields.status.name || '',
          id: issueFields.status.id || ''
        } : null,
        duedate: issueFields.duedate || null,
        priority: issueFields.priority ? {
          name: issueFields.priority.name || '',
          id: issueFields.priority.id || ''
        } : null
      };
    });
    
    console.log('[Backend] Fetched', tasks.length, 'tasks for simulation');
    console.log('[Backend] Task keys:', tasks.map(t => t.key).join(', '));
    
    return tasks;
  } catch (error) {
    console.error('[Backend] Error fetching simulation data:', error);
    console.error('[Backend] Error stack:', error.stack);
    // Return empty array on error to prevent frontend crashes
    return [];
  }
});

resolver.define('getText', (req) => {
  console.log(req);
  return 'Hello, world!';
});

// Verify resolver definitions are set up correctly
const definitions = resolver.getDefinitions();
console.log('[Backend] Resolver definitions registered:', Object.keys(definitions));

export const handler = definitions;
