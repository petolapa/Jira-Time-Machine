const { fetch: forgeFetch } = require('@forge/api');
const { WORKFLOW_ANALYSIS_PROMPT } = require('../prompts/workflowAnalysis');

// GCP Cloud Function endpoint
const GCP_ENDPOINT = 'https://us-central1-gen-lang-client-0395589036.cloudfunctions.net/analyze-workflow';

/**
 * Sends Jira task data to GCP for Gemini-powered analysis.
 * 
 * @param {Array} tasks - Array of task objects from fetchSimulationData
 * @param {Object} scenarios - Scenario configuration (members, actions, etc.)
 * @returns {Promise<Object>} Analysis results from Gemini
 */
async function analyzeEmergentWorkflows(tasks, scenarios) {
    try {
        const response = await forgeFetch(GCP_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tasks: tasks,
                scenarios: scenarios,
                promptTemplate: WORKFLOW_ANALYSIS_PROMPT
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GCP call failed:', response.status, errorText);
            return {
                volatilityScore: 0,
                identifiedRisks: [{ type: 'Error', description: 'GCP connectivity issue', severity: 'High' }],
                strategicAdvice: ['Check GCP Cloud Function logs.']
            };
        }

        const analysis = await response.json();
        return analysis;

    } catch (error) {
        console.error('Exception during AI Analysis:', error.message);
        return {
            volatilityScore: 0,
            identifiedRisks: [{ type: 'Error', description: 'Internal Resolver Error', severity: 'High' }],
            strategicAdvice: ['Check Forge logs for details.']
        };
    }
}

module.exports = { analyzeEmergentWorkflows };
