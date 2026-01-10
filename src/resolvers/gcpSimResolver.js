const { fetch: forgeFetch } = require('@forge/api');
const { WORKFLOW_ANALYSIS_PROMPT } = require('../prompts/workflowAnalysis');

/**
 * Sends Jira task data to GCP for Gemini-powered analysis.
 * 
 * @param {Array} tasks - Array of task objects from fetchSimulationData
 * @returns {Promise<Object>} Analysis results from Gemini
 */
async function analyzeEmergentWorkflows(tasks, scenarios) {
    try {
        console.log('[GCP Resolver] Preparing analysis for', tasks.length, 'tasks with scenarios:', scenarios);

        // In a real scenario, we'd process the prompt here or on the GCP side.
        // We send the raw data to GCP to keep the Forge resolver light.
        // Use absolute URL for fetch (remote key is for requestRemote)
        const response = await forgeFetch('https://us-central1-gen-lang-client-0395589036.cloudfunctions.net/analyze-workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tasks: tasks,
                scenarios: scenarios, // Pass scenarios to GCP
                promptTemplate: WORKFLOW_ANALYSIS_PROMPT
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GCP Resolver] Remote call failed:', response.status, errorText);
            return {
                volatilityScore: 0,
                identifiedRisks: [{ type: 'Error', description: 'GCP connectivity issue', severity: 'High' }],
                strategicAdvice: ['Check GCP Cloud Function logs and Forge Remote configuration.']
            };
        }

        const analysis = await response.json();
        console.log('[GCP Resolver] Received AI Analysis:', analysis);
        return analysis;

    } catch (error) {
        console.error('[GCP Resolver] Exception during AI Analysis:', error);
        return {
            volatilityScore: 0,
            identifiedRisks: [{ type: 'Error', description: 'Internal Resolver Error', severity: 'High' }],
            strategicAdvice: ['Check Forge logs for resolver stack trace.']
        };
    }
}

module.exports = { analyzeEmergentWorkflows };
