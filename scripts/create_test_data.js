/**
 * Project Triton Test Data Generator
 * 
 * Usage:
 * 1. Set the following environment variables:
 *    JIRA_SITE_URL (e.g., https://your-domain.atlassian.net)
 *    JIRA_EMAIL (your Atlassian account email)
 *    JIRA_API_TOKEN (generate at https://id.atlassian.com/manage-profile/security/api-tokens)
 * 2. Run: node scripts/create_test_data.js
 */

const JIRA_SITE_URL = process.env.JIRA_SITE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'KAN';

if (!JIRA_SITE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: Missing environment variables JIRA_SITE_URL, JIRA_EMAIL, or JIRA_API_TOKEN');
    process.exit(1);
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const headers = {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

const issuesToCreate = [
    { summary: 'Implement Monte Carlo simulation for project forecasting', type: 'Feature', status: 'In Progress' },
    { summary: 'Refactor storage layer to use Forge Storage API v2', type: 'Task', status: 'To Do' },
    { summary: 'Fix memory leak in timeline visualization component', type: 'Bug', status: 'Idea' },
    { summary: 'Design glassmorphism UI components for the main dashboard', type: 'Feature', status: 'Idea' },
    { summary: 'Add user settings page for notification preferences', type: 'Story', status: 'Done' },
    { summary: 'Optimize AI analysis prompts for better accuracy', type: 'Task', status: 'In Review' },
    { summary: 'Implement real-time collaboration using webhooks', type: 'Feature', status: 'To Do' },
    { summary: 'Fix CSS z-index issue on the scenario selection modal', type: 'Bug', status: 'Done' },
    { summary: 'Add support for multi-project analysis', type: 'Story', status: 'Idea' },
    { summary: 'Research Atlassian Analytics API integration', type: 'Task', status: 'In Progress' },
    { summary: 'Update documentation for the new simulation logic', type: 'Task', status: 'To Do' },
    { summary: 'Implement data export to CSV and JSON', type: 'Story', status: 'Idea' },
    { summary: 'Fix broken avatars in the member select component', type: 'Bug', status: 'In Review' },
    { summary: 'Add keyboard shortcuts for fast scenario switching', type: 'Feature', status: 'To Do' },
    { summary: 'Analyze performance bottlenecks in large 프로젝트', type: 'Task', status: 'In Progress' },
    { summary: 'Create onboarding tour for first-time users', type: 'Story', status: 'Idea' },
    { summary: 'Fix race condition in analysis persistence', type: 'Bug', status: 'Done' },
    { summary: 'Implement dark mode theme support', type: 'Feature', status: 'Idea' },
    { summary: 'Add tooltips for all complex metrics', type: 'Story', status: 'Done' },
    { summary: 'Audit security permissions for sensitive data access', type: 'Task', status: 'To Do' }
];

async function createIssue(issue) {
    const body = {
        fields: {
            project: { key: PROJECT_KEY },
            summary: issue.summary,
            issuetype: { name: issue.type },
        }
    };

    try {
        const response = await fetch(`${JIRA_SITE_URL}/rest/api/3/issue`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to create issue "${issue.summary}":`, error);
            return null;
        }

        const data = await response.json();
        console.log(`Created issue: ${data.key} - ${issue.summary}`);
        return data.key;
    } catch (err) {
        console.error(`Error creating issue "${issue.summary}":`, err.message);
        return null;
    }
}

async function transitionIssue(issueKey, statusName) {
    if (!statusName || statusName === 'To Do' || statusName === 'Idea') return; // Default is Idea or To Do

    try {
        // Get available transitions
        const transitionsResponse = await fetch(`${JIRA_SITE_URL}/rest/api/3/issue/${issueKey}/transitions`, {
            method: 'GET',
            headers
        });
        const transitionsData = await transitionsResponse.json();
        const transition = transitionsData.transitions.find(t => t.to.name === statusName);

        if (transition) {
            await fetch(`${JIRA_SITE_URL}/rest/api/3/issue/${issueKey}/transitions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ transition: { id: transition.id } })
            });
            console.log(`Transitioned ${issueKey} to ${statusName}`);
        }
    } catch (err) {
        console.error(`Error transitioning ${issueKey}:`, err.message);
    }
}

async function inviteUser(index) {
    const email = JIRA_EMAIL.replace('@', `+test${index}@`);
    const body = {
        emailAddress: email,
        products: ['jira-software']
    };

    try {
        const response = await fetch(`${JIRA_SITE_URL}/rest/api/3/user`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to invite user "${email}":`, error);
        } else {
            console.log(`Invited user: ${email}`);
        }
    } catch (err) {
        console.error(`Error inviting user "${email}":`, err.message);
    }
}

async function main() {
    console.log('Starting test data generation...');

    // 1. Create Issues
    for (const issue of issuesToCreate) {
        const key = await createIssue(issue);
        if (key) {
            await transitionIssue(key, issue.status);
        }
    }

    // 2. Invite Users (10 users) - DEFERRED BY USER
    /*
    console.log('\nInviting test users...');
    for (let i = 1; i <= 10; i++) {
        await inviteUser(i);
    }
    */

    console.log('\nGeneration complete!');
}

main();
