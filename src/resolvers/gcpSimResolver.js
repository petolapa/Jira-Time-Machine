const { fetch: forgeFetch } = require('@forge/api');
const { WORKFLOW_ANALYSIS_PROMPT } = require('../prompts/workflowAnalysis');

/**
 * Sends Jira task data to GCP for Gemini-powered analysis.
 * 
 * @param {Array} tasks - Array of task objects from fetchSimulationData
 * @returns {Promise<Object>} Analysis results from Gemini
 */
async function analyzeEmergentWorkflows(tasks) {
    try {
        console.log('[GCP Resolver] Preparing analysis for', tasks.length, 'tasks');

        // In a real scenario, we'd process the prompt here or on the GCP side.
        // We send the raw data to GCP to keep the Forge resolver light.
        const response = await forgeFetch('gcp-simulation-engine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tasks: tasks,
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
