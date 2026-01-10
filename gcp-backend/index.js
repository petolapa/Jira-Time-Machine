const functions = require('@google-cloud/functions-framework');
const { VertexAI } = require('@google-cloud/vertexai');

/**
 * GCP Cloud Function: analyze-workflow
 * 
 * Receives Jira task data and a prompt template, handles Gemini 1.5 Pro
 * invocation, and returns a JSON risk analysis.
 */
functions.http('analyze-workflow', async (req, res) => {
    try {
        const { tasks, promptTemplate } = req.body;

        if (!tasks || !promptTemplate) {
            return res.status(400).send('Missing tasks or promptTemplate');
        }

        // Initialize Vertex AI
        const vertexAI = new VertexAI({ project: 'YOUR_GCP_PROJECT_ID', location: 'us-central1' });
        const generativeModel = vertexAI.getGenerativeModel({
            model: 'gemini-1.5-pro',
        });

        // Prepare Prompt
        const projectDataJson = JSON.stringify(tasks, null, 2);
        const finalPrompt = promptTemplate.replace('{{PROJECT_DATA_JSON}}', projectDataJson);

        const request = {
            contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        };

        // Invoke Gemini
        const result = await generativeModel.generateContent(request);
        const response = await result.response;
        const text = response.candidates[0].content.parts[0].text;

        // Clean up response (Gemini sometimes adds markdown blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse AI response' };

        res.status(200).json(jsonResponse);

    } catch (error) {
        console.error('Error during AI Analysis:', error);
        res.status(500).send('Internal Server Error');
    }
});
